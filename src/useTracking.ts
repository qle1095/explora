import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { gridPathCells, latLngToCell } from "h3-js";

import { REVEAL_RES } from "./fog";
import { saveCells, saveTrail } from "./db";
import { onDevWalk } from "./devWalk";

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
  const mockActive = useRef(false);

  const handleFix = useCallback(
    (latitude: number, longitude: number) => {
      const pt: [number, number] = [longitude, latitude];
      setPosition(pt);
      points.current.push(pt);
      setTrail([...points.current]);

      const cell = latLngToCell(latitude, longitude, REVEAL_RES);
      let fresh: string[];
      if (!lastCell.current) {
        fresh = [cell];
      } else if (lastCell.current === cell) {
        fresh = [];
      } else {
        try {
          fresh = gridPathCells(lastCell.current, cell);
        } catch {
          // h3 refuses to path between distant cells, so a flight or a GPS
          // jump throws here. Record where we actually are instead: letting
          // this escape would skip the `lastCell` update below and wedge
          // every later fix against a cell on the far side of the planet.
          fresh = [cell];
        }
      }
      lastCell.current = cell;
      if (fresh.length) {
        saveCells(fresh);
        onCells(fresh);
      }
    },
    [onCells],
  );

  // Dev D-pad walks through the same path as real GPS; once used, real
  // fixes are ignored for the session so the two sources don't fight.
  useEffect(() => {
    if (!__DEV__) return;
    return onDevWalk((lat, lng) => {
      mockActive.current = true;
      handleFix(lat, lng);
    });
  }, [handleFix]);

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
        distanceInterval: 1,
        timeInterval: 300,
      },
      (loc) => {
        if (mockActive.current) return;
        handleFix(loc.coords.latitude, loc.coords.longitude);
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

  // Forget the current session's path (used by map reset).
  const clearSession = useCallback(() => {
    points.current = position ? [position] : [];
    lastCell.current = null;
    setTrail([...points.current]);
  }, [position]);

  // retry() re-attempts after a permission grant (e.g. right after onboarding).
  return { denied, position, trail, retry: begin, clearSession };
}
