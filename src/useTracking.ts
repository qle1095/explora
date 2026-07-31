import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { gridPathCells, latLngToCell } from "h3-js";

import { REVEAL_RES } from "./fog";
import { saveCells, saveTrail } from "./db";

/**
 * Foreground tracking is automatic — the fog clears whenever the app is
 * open, no button. High-accuracy GPS runs while the app is active and
 * stops the moment it goes to background (where the passive visit task
 * takes over). Each foreground session's trail is saved on exit.
 */
export function useTracking(onCells: (cells: string[]) => void) {
  const [denied, setDenied] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);

  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastCell = useRef<string | null>(null);
  const startedAt = useRef(0);
  const points = useRef<[number, number][]>([]);

  const end = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    if (points.current.length > 1) {
      saveTrail(startedAt.current, points.current);
    }
    points.current = [];
    lastCell.current = null;
  }, []);

  const begin = useCallback(async () => {
    if (sub.current) return;
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      setDenied(true);
      return;
    }
    setDenied(false);
    startedAt.current = Date.now();
    points.current = [];
    setTrail([]);
    sub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
        timeInterval: 2000,
      },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        const pt: [number, number] = [longitude, latitude];
        setPosition(pt);
        points.current.push(pt);
        setTrail([...points.current]);

        const cell = latLngToCell(latitude, longitude, REVEAL_RES);
        const fresh =
          lastCell.current && lastCell.current !== cell
            ? gridPathCells(lastCell.current, cell)
            : lastCell.current === cell
              ? []
              : [cell];
        lastCell.current = cell;
        if (fresh.length) {
          saveCells(fresh);
          onCells(fresh);
        }
      },
    );
  }, [onCells]);

  useEffect(() => {
    void begin();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void begin();
      else if (state === "background") end();
    });
    return () => {
      appState.remove();
      end();
    };
  }, [begin, end]);

  // retry() re-attempts after a permission grant (e.g. right after onboarding).
  return { denied, position, trail, retry: begin };
}
