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

export async function startBackgroundTracking(): Promise<BackgroundStatus> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "denied";
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return "denied";

  if (!(await Location.hasStartedLocationUpdatesAsync(BG_TASK))) {
    await Location.startLocationUpdatesAsync(BG_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 150,
      deferredUpdatesInterval: 60_000,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: "Explora is mapping your travels",
        notificationBody: "Fog clears where you go.",
        notificationColor: "#43b8b0",
      },
    });
  }
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
