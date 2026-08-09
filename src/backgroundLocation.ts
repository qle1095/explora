import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { gridDisk, latLngToCell } from "h3-js";

import { REVEAL_RES } from "./fog";
import { addVisitPoint, saveCells } from "./db";

/**
 * Passive "visit mode": battery-cheap background fixes reveal a chunk of
 * fog (~1-ring of cells, ≈250m across) around wherever the user dwells.
 * The task must be defined at module load — index.ts imports this file.
 */
export const BG_TASK = "explora-bg-location";

TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const cells = new Set<string>();
  for (const loc of locations) {
    const { latitude, longitude } = loc.coords;
    // Circle sweep is the visual reveal; cells remain the stats record.
    addVisitPoint(latitude, longitude);
    const center = latLngToCell(latitude, longitude, REVEAL_RES);
    for (const c of gridDisk(center, 1)) cells.add(c);
  }
  if (cells.size) saveCells(cells);
});

export type BackgroundStatus = "on" | "off" | "denied";

/**
 * Stop-then-start rather than skipping when already registered. iOS can
 * pause a running task on its own and never resumes it — and a paused task
 * still reports as started, so a `hasStartedLocationUpdatesAsync` guard here
 * would turn every pause into permanent silence.
 */
async function armUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) {
    await Location.stopLocationUpdatesAsync(BG_TASK);
  }
  await Location.startLocationUpdatesAsync(BG_TASK, {
    accuracy: Location.Accuracy.Balanced,
    // Apple suspends background delivery when coarse accuracy is combined
    // with distance filtering, so keep the filter well inside the ~100m the
    // Balanced accuracy already costs us.
    distanceInterval: 50,
    // Never let the system pause us. Explora is a lifetime record; a gap it
    // cannot detect is worse than the battery a steady coarse fix costs.
    pausesUpdatesAutomatically: false,
    // Fitness makes iOS treat a stop as "workout over" and go quiet. This is
    // ambient life logging, not a workout.
    activityType: Location.ActivityType.Other,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: "Explora is mapping your travels",
      notificationBody: "Fog clears where you go.",
      notificationColor: "#43b8b0",
    },
  });
}

/** Prompts for permission — for onboarding and the explicit toggle. */
export async function startBackgroundTracking(): Promise<BackgroundStatus> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "denied";
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return "denied";
  await armUpdates();
  return "on";
}

/**
 * Re-arm without ever prompting — safe to call on every foreground, which
 * is exactly when a pause that happened while we were away needs undoing.
 */
export async function ensureBackgroundTracking(): Promise<BackgroundStatus> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  if (fg.status !== "granted" || bg.status !== "granted") return "denied";
  await armUpdates();
  return "on";
}

export async function stopBackgroundTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) {
    await Location.stopLocationUpdatesAsync(BG_TASK);
  }
}

export async function isBackgroundTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BG_TASK);
}
