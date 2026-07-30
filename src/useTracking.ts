import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { gridPathCells, latLngToCell } from "h3-js";

import { REVEAL_RES } from "./fog";
import { saveCells, saveTrail } from "./db";

/**
 * Foreground "explorer mode": continuous GPS watch while the app is open.
 * Every fix reveals the cells along the path since the last fix and is
 * persisted immediately; the raw trail is saved when tracking stops.
 */
export function useTracking(onCells: (cells: string[]) => void) {
  const [tracking, setTracking] = useState(false);
  const [denied, setDenied] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);

  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastCell = useRef<string | null>(null);
  const startedAt = useRef(0);
  const points = useRef<[number, number][]>([]);

  const stop = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    if (points.current.length > 1) {
      saveTrail(startedAt.current, points.current);
    }
    points.current = [];
    lastCell.current = null;
    setTracking(false);
  }, []);

  const start = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
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
    setTracking(true);
  }, [onCells]);

  useEffect(
    () => () => {
      sub.current?.remove();
    },
    [],
  );

  return { tracking, denied, position, trail, start, stop };
}
