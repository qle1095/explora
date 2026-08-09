import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeSyntheticEvent } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapView,
  type CameraRef,
  type PressEvent,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import type { Feature, FeatureCollection, Point } from "geojson";

import {
  buildFogShape,
  buildRevealMask,
  exploredStats,
  thinPoints,
  unionMasks,
  circlesUnion,
  type LngLat,
} from "./src/fog";
import * as Location from "expo-location";

import {
  addNote,
  deleteNote,
  exploredDays,
  getKV,
  listNotes,
  listVisitPoints,
  loadCells,
  loadTrails,
  resetMap,
  setKV,
  type PlaceNote,
} from "./src/db";
import { useTracking } from "./src/useTracking";
import {
  isBackgroundTracking,
  ensureBackgroundTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
} from "./src/backgroundLocation";
import { reversePlace, type PlaceResult } from "./src/places";
import { NoteSheet } from "./src/ui/NoteSheet";
import { PlacesModal } from "./src/ui/PlacesModal";
import { StatsModal } from "./src/ui/StatsModal";
import { Onboarding } from "./src/ui/Onboarding";
import { DevPad } from "./src/ui/DevPad";
import { FogOverlay } from "./src/ui/FogOverlay";
import { card, colors, font } from "./src/ui/theme";

// Storybook recolor of OpenFreeMap liberty (regenerate: scripts/make_mapstyle.py)
const MAP_STYLE = require("./assets/mapstyle.json");
const START_CENTER: [number, number] = [-122.4193, 37.7893];

export default function App() {
  const [cells, setCells] = useState(() => new Set(loadCells()));
  const [notes, setNotes] = useState<PlaceNote[]>(() => listNotes());
  const [pastTrails, setPastTrails] = useState(() => loadTrails());
  const [visitPoints, setVisitPoints] = useState<LngLat[]>(() =>
    listVisitPoints(),
  );
  const [sheetPlace, setSheetPlace] = useState<PlaceResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => getKV("onboarded") === "1");
  const [auto, setAuto] = useState(false);
  const [follow, setFollow] = useState(true);
  const cameraRef = useRef<CameraRef>(null);
  const mapWrapRef = useRef<View>(null);

  // Background exploring is inherent, not a mode: (re)arm it on every
  // launch once onboarded. Idempotent; quietly a no-op if permission is
  // missing (foreground exploring still works).
  useEffect(() => {
    if (!onboarded) return;
    void ensureBackgroundTracking().then((r) => setAuto(r === "on"));
  }, [onboarded]);

  const centerOnUser = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      const fix =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      if (fix) {
        cameraRef.current?.jumpTo({
          center: [fix.coords.longitude, fix.coords.latitude],
          zoom: 16,
        });
      }
    } catch {
      // No fix available (e.g. simulator with location unset) — stay put.
    }
  }, []);

  useEffect(() => {
    if (onboarded) void centerOnUser();
  }, [onboarded, centerOnUser]);

  const finishOnboarding = async () => {
    setKV("onboarded", "1");
    setOnboarded(true);
    await Location.requestForegroundPermissionsAsync();
    void retry();
    void centerOnUser();
    // Passive exploring is the default — the map should fill itself.
    const result = await startBackgroundTracking();
    setAuto(result === "on");
  };

  // The background task writes straight to SQLite; pick its work up whenever
  // the app returns to the foreground. Trails matter here too: the session
  // that just ended was flushed to the DB on the way out, and until it is
  // read back the fog re-covers everywhere it was walked.
  //
  // Re-arming belongs on the same edge — iOS may have paused the task while
  // we were away, and it never restarts one on its own.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setCells(new Set(loadCells()));
      setVisitPoints(listVisitPoints());
      setPastTrails(loadTrails());
      if (onboarded) {
        void ensureBackgroundTracking().then((r) => setAuto(r === "on"));
      }
    });
    return () => sub.remove();
  }, [onboarded]);

  const onCells = useCallback((fresh: string[]) => {
    setCells((prev) => {
      const next = new Set(prev);
      for (const c of fresh) next.add(c);
      return next;
    });
  }, []);

  const { denied, position, trail, retry, clearSession } =
    useTracking(onCells);

  const handleResetMap = () => {
    resetMap();
    setCells(new Set());
    setVisitPoints([]);
    setPastTrails([]);
    clearSession();
    setStatsOpen(false);
  };

  // Static mask (history) is expensive and rarely changes; the live part
  // (current session trail + vision circle) re-unions every fix.
  const baseMask = useMemo(
    () => buildRevealMask(pastTrails, visitPoints),
    [pastTrails, visitPoints],
  );
  const rimBaseMask = useMemo(
    () => buildRevealMask(pastTrails, visitPoints, 0.84),
    [pastTrails, visitPoints],
  );
  const livePoints = useMemo(() => {
    const pts: LngLat[] = thinPoints(trail);
    if (position) pts.push(position);
    return pts;
  }, [trail, position]);
  const fogShape = useMemo(
    () => buildFogShape(unionMasks(baseMask, circlesUnion(livePoints))),
    [baseMask, livePoints],
  );
  const rimShape = useMemo(
    () =>
      buildFogShape(unionMasks(rimBaseMask, circlesUnion(livePoints, 0.84))),
    [rimBaseMask, livePoints],
  );
  const stats = useMemo(() => exploredStats(cells), [cells]);

  const trailShape = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [...pastTrails, trail]
        .filter((t) => t.length > 1)
        .map((t) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: t },
        })),
    }),
    [pastTrails, trail],
  );

  const notesShape = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: notes.map((n) => ({
        type: "Feature",
        properties: { name: n.name, verdict: n.verdict },
        geometry: { type: "Point", coordinates: [n.lng, n.lat] },
      })),
    }),
    [notes],
  );

  const puckShape = useMemo<Feature<Point> | null>(
    () =>
      position
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: position },
          }
        : null,
    [position],
  );

  const handleLongPress = async (event: NativeSyntheticEvent<PressEvent>) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    setSheetPlace(null);
    setSheetOpen(true);
    const place = await reversePlace(lat, lng);
    setSheetPlace(place ?? { name: "Dropped pin", detail: "", lat, lng });
  };

  const handleSaveNote = (
    place: PlaceResult,
    body: string,
    verdict: boolean,
  ) => {
    addNote(place.name, place.lat, place.lng, body, verdict);
    setNotes(listNotes());
    setSheetOpen(false);
    setSheetPlace(null);
  };

  const flyToNote = (note: PlaceNote) => {
    setPlacesOpen(false);
    cameraRef.current?.flyTo({
      center: [note.lng, note.lat],
      zoom: 15,
      duration: 1200,
    });
  };

  const toggleBackground = async () => {
    if (auto) {
      await stopBackgroundTracking();
      setAuto(false);
    } else {
      const result = await startBackgroundTracking();
      if (result === "denied") {
        Alert.alert(
          "Always access needed",
          "Background exploring needs 'Always' location access so fog can clear with the app closed. You can enable it in Settings.",
        );
      } else {
        setAuto(true);
      }
    }
  };

  const shareMap = async () => {
    const uri = await captureRef(mapWrapRef, { format: "png", quality: 0.95 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your Explora map",
      });
    }
  };

  // Camera follows the puck (Google-Maps style) until the user pans away;
  // the ⌖ button re-engages it.
  useEffect(() => {
    if (follow && position) {
      cameraRef.current?.easeTo({ center: position, duration: 600 });
    }
  }, [follow, position]);

  const handleRegionWillChange = (
    event: NativeSyntheticEvent<ViewStateChangeEvent>,
  ) => {
    if (event.nativeEvent.userInteraction) setFollow(false);
  };

  const recenter = () => {
    setFollow(true);
    if (position) {
      cameraRef.current?.easeTo({ center: position, zoom: 16, duration: 600 });
    } else {
      void centerOnUser();
    }
  };

  return (
    <View style={styles.container}>
      <View ref={mapWrapRef} collapsable={false} style={styles.map}>
        <MapView
          style={styles.map}
          mapStyle={MAP_STYLE}
          onLongPress={handleLongPress}
          onRegionWillChange={handleRegionWillChange}
        >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: START_CENTER, zoom: 16 }}
        />
        <Images
          images={{
            clouds: require("./assets/clouds.png"),
            avatar: require("./assets/avatar.png"),
            waterTile: require("./assets/water.png"),
            grassTile: require("./assets/grass.png"),
            forestTile: require("./assets/forest.png"),
            roadMain: require("./assets/road-main.png"),
            roadPath: require("./assets/road-path.png"),
            footprints: require("./assets/footprints.png"),
            pinFood: require("./assets/pin-food.png"),
            pinSight: require("./assets/pin-sight.png"),
          }}
        />
        <FogOverlay fogShape={fogShape} rimShape={rimShape} />
        <GeoJSONSource id="trails" data={trailShape}>
          <Layer
            type="line"
            id="trail-line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{
              "line-pattern": "footprints",
              "line-width": 11,
              "line-opacity": 0.9,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="notes" data={notesShape}>
          <Layer
            type="circle"
            id="note-pins"
            paint={{
              "circle-radius": 6,
              "circle-color": [
                "case",
                ["==", ["get", "verdict"], 1],
                "#e0a055",
                "#5c7476",
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0b1417",
            }}
          />
        </GeoJSONSource>
          {puckShape && (
            <GeoJSONSource id="puck" data={puckShape}>
              <Layer
                type="symbol"
                id="puck-avatar"
                layout={{
                  "icon-image": "avatar",
                  "icon-size": 0.19,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                }}
              />
            </GeoJSONSource>
          )}
        </MapView>
      </View>

      <Pressable style={styles.hud} onPress={() => setStatsOpen(true)}>
        <Text style={styles.hudTitle}>Explora</Text>
        <Text style={styles.hudStat}>
          You've uncovered {stats.areaKm2.toFixed(1)} km² of the world ·{" "}
          {stats.count.toLocaleString()} patches
        </Text>
        <Text style={styles.hudHint}>
          {denied
            ? "Explora needs location to clear the fog — enable it in Settings"
            : "the fog is waiting… · tap here for your journal"}
        </Text>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          style={[styles.button, styles.squareButton, follow && styles.buttonActive]}
          onPress={recenter}
        >
          <Text style={styles.buttonEmoji}>🧭</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setPlacesOpen(true)}>
          <Text style={styles.buttonText}>📔 My places ({notes.length})</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.squareButton]}
          onPress={() => {
            setSheetPlace(null);
            setSheetOpen(true);
          }}
        >
          <Text style={styles.buttonEmoji}>📍</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.squareButton]}
          onPress={() => void shareMap()}
        >
          <Text style={styles.buttonEmoji}>📸</Text>
        </Pressable>
      </View>

      <NoteSheet
        visible={sheetOpen}
        place={sheetPlace}
        near={position ?? START_CENTER}
        onSave={handleSaveNote}
        onClose={() => {
          setSheetOpen(false);
          setSheetPlace(null);
        }}
      />
      <PlacesModal
        visible={placesOpen}
        notes={notes}
        onSelect={flyToNote}
        onDelete={(id) => {
          deleteNote(id);
          setNotes(listNotes());
        }}
        onClose={() => setPlacesOpen(false)}
      />
      <StatsModal
        visible={statsOpen}
        cellCount={stats.count}
        areaKm2={stats.areaKm2}
        earthPct={stats.earthPct}
        days={statsOpen ? exploredDays() : []}
        notes={notes}
        backgroundOn={auto}
        onToggleBackground={() => void toggleBackground()}
        onReset={handleResetMap}
        onClose={() => setStatsOpen(false)}
      />
      {__DEV__ && <DevPad origin={position} />}
      {!onboarded && <Onboarding onDone={() => void finishOnboarding()} />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#22333a" },
  map: { flex: 1 },
  hud: {
    ...card,
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    alignItems: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  hudTitle: {
    color: colors.accentDeep,
    fontFamily: font.bold,
    fontSize: 15,
  },
  hudStat: {
    color: colors.textPrimary,
    fontFamily: font.demi,
    fontSize: 13.5,
    marginTop: 2,
  },
  hudHint: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 11.5,
    marginTop: 1,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 9,
  },
  button: {
    ...card,
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  squareButton: { flex: 0, width: 48 },
  buttonActive: { backgroundColor: colors.accent, borderColor: colors.accentDeep },
  buttonEmoji: { fontSize: 19 },
  buttonText: {
    color: colors.textPrimary,
    fontFamily: font.demi,
    fontSize: 14,
  },
  buttonTextActive: { color: colors.onAccent },
});
