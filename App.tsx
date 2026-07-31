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
  Layer,
  Map as MapView,
  type CameraRef,
  type PressEvent,
} from "@maplibre/maplibre-react-native";
import type { Feature, FeatureCollection, Point } from "geojson";

import { buildFogShape, exploredStats, revealAt } from "./src/fog";
import * as Location from "expo-location";

import {
  addNote,
  deleteNote,
  exploredDays,
  getKV,
  listNotes,
  loadCells,
  loadTrails,
  saveCells,
  setKV,
  type PlaceNote,
} from "./src/db";
import { useTracking } from "./src/useTracking";
import {
  isBackgroundTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
} from "./src/backgroundLocation";
import { reversePlace, type PlaceResult } from "./src/places";
import { NoteSheet } from "./src/ui/NoteSheet";
import { PlacesModal } from "./src/ui/PlacesModal";
import { StatsModal } from "./src/ui/StatsModal";
import { Onboarding } from "./src/ui/Onboarding";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const START_CENTER: [number, number] = [-122.4193, 37.7893];

export default function App() {
  const [cells, setCells] = useState(() => new Set(loadCells()));
  const [notes, setNotes] = useState<PlaceNote[]>(() => listNotes());
  const [pastTrails] = useState(() => loadTrails());
  const [sheetPlace, setSheetPlace] = useState<PlaceResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => getKV("onboarded") === "1");
  const [auto, setAuto] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  const mapWrapRef = useRef<View>(null);

  useEffect(() => {
    void isBackgroundTracking().then(setAuto);
  }, []);

  const centerOnUser = useCallback(async () => {
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
        zoom: 13,
      });
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

  // The background task writes cells straight to SQLite; pick them up
  // whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setCells(new Set(loadCells()));
    });
    return () => sub.remove();
  }, []);

  const onCells = useCallback((fresh: string[]) => {
    setCells((prev) => {
      const next = new Set(prev);
      for (const c of fresh) next.add(c);
      return next;
    });
  }, []);

  const { denied, position, trail, retry } = useTracking(onCells);

  const fogShape = useMemo(() => buildFogShape(cells), [cells]);
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

  // Dev cheat while GPS is off: tap to reveal (persisted like a real visit).
  const handlePress = (event: NativeSyntheticEvent<PressEvent>) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    setCells((prev) => {
      const next = revealAt(prev, lat, lng);
      const fresh = [...next].filter((c) => !prev.has(c));
      if (fresh.length) saveCells(fresh);
      return next;
    });
  };

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

  const toggleAuto = async () => {
    if (auto) {
      await stopBackgroundTracking();
      setAuto(false);
    } else {
      const result = await startBackgroundTracking();
      if (result === "denied") {
        Alert.alert(
          "Always access needed",
          "Passive exploring needs 'Always' location access so fog can clear with the app closed. You can enable it in Settings.",
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

  const recenter = () => {
    if (position) {
      cameraRef.current?.easeTo({ center: position, zoom: 15, duration: 600 });
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
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: START_CENTER, zoom: 12.5 }}
        />
        <GeoJSONSource id="fog" data={fogShape}>
          <Layer
            type="fill"
            id="fog-fill"
            paint={{
              "fill-color": "#0b1417",
              "fill-opacity": 0.86,
              "fill-outline-color": "#43b8b0",
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="trails" data={trailShape}>
          <Layer
            type="line"
            id="trail-line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{
              "line-color": "#e0a055",
              "line-width": 3,
              "line-opacity": 0.75,
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
                type="circle"
                id="puck-dot"
                paint={{
                  "circle-radius": 7,
                  "circle-color": "#43b8b0",
                  "circle-stroke-width": 3,
                  "circle-stroke-color": "#ffffff",
                }}
              />
            </GeoJSONSource>
          )}
        </MapView>
      </View>

      <Pressable style={styles.hud} onPress={() => setStatsOpen(true)}>
        <Text style={styles.hudTitle}>EXPLORA</Text>
        <Text style={styles.hudStat}>
          {stats.count.toLocaleString()} cells · {stats.areaKm2.toFixed(1)} km²
          · {stats.earthPct}% of Earth
        </Text>
        <Text style={styles.hudHint}>
          {denied
            ? "location permission denied — enable it in Settings"
            : "fog clears as you go · tap here for stats"}
        </Text>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          style={[styles.button, styles.squareButton]}
          onPress={recenter}
        >
          <Text style={styles.buttonText}>⌖</Text>
        </Pressable>
        <Pressable
          style={[styles.button, auto && styles.buttonActive]}
          onPress={() => void toggleAuto()}
        >
          <Text style={[styles.buttonText, auto && styles.buttonTextActive]}>
            {auto ? "Auto ✓" : "Auto"}
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setPlacesOpen(true)}>
          <Text style={styles.buttonText}>Places ({notes.length})</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.squareButton]}
          onPress={() => {
            setSheetPlace(null);
            setSheetOpen(true);
          }}
        >
          <Text style={styles.buttonText}>＋</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.squareButton]}
          onPress={() => void shareMap()}
        >
          <Text style={styles.buttonText}>↗</Text>
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
        onClose={() => setStatsOpen(false)}
      />
      {!onboarded && <Onboarding onDone={() => void finishOnboarding()} />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1417" },
  map: { flex: 1 },
  hud: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    alignItems: "flex-start",
    backgroundColor: "rgba(11, 20, 23, 0.82)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(67, 184, 176, 0.35)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hudTitle: {
    color: "#43b8b0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
  },
  hudStat: { color: "#e2ecea", fontSize: 14, marginTop: 4 },
  hudHint: { color: "#92a7a7", fontSize: 11, marginTop: 2 },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: "rgba(11, 20, 23, 0.88)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 184, 176, 0.35)",
    alignItems: "center",
    paddingVertical: 13,
  },
  squareButton: { flex: 0, width: 46 },
  buttonActive: { backgroundColor: "#43b8b0" },
  buttonText: { color: "#e2ecea", fontWeight: "700", fontSize: 14 },
  buttonTextActive: { color: "#0b1417" },
});
