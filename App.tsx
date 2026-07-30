import { useCallback, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeSyntheticEvent } from "react-native";
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
import {
  addNote,
  deleteNote,
  listNotes,
  loadCells,
  loadTrails,
  saveCells,
  type PlaceNote,
} from "./src/db";
import { useTracking } from "./src/useTracking";
import { reversePlace, type PlaceResult } from "./src/places";
import { NoteSheet } from "./src/ui/NoteSheet";
import { PlacesModal } from "./src/ui/PlacesModal";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const START_CENTER: [number, number] = [-122.4193, 37.7893];

export default function App() {
  const [cells, setCells] = useState(() => new Set(loadCells()));
  const [notes, setNotes] = useState<PlaceNote[]>(() => listNotes());
  const [pastTrails] = useState(() => loadTrails());
  const [sheetPlace, setSheetPlace] = useState<PlaceResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const cameraRef = useRef<CameraRef>(null);

  const onCells = useCallback((fresh: string[]) => {
    setCells((prev) => {
      const next = new Set(prev);
      for (const c of fresh) next.add(c);
      return next;
    });
  }, []);

  const { tracking, denied, position, trail, start, stop } =
    useTracking(onCells);

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
        properties: { name: n.name },
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

  const handleSaveNote = (place: PlaceResult, body: string) => {
    addNote(place.name, place.lat, place.lng, body);
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

  const toggleTracking = () => {
    if (tracking) {
      stop();
    } else {
      void start();
      if (position) {
        cameraRef.current?.easeTo({ center: position, zoom: 15, duration: 600 });
      }
    }
  };

  return (
    <View style={styles.container}>
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
              "circle-color": "#e0a055",
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

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTitle}>EXPLORA</Text>
        <Text style={styles.hudStat}>
          {stats.count.toLocaleString()} cells · {stats.areaKm2.toFixed(1)} km²
          · {stats.earthPct}% of Earth
        </Text>
        <Text style={styles.hudHint}>
          {denied
            ? "location permission denied — enable it in Settings"
            : tracking
              ? "exploring — fog clears where you go"
              : "tap map to reveal · long-press to save a place"}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.button, tracking && styles.buttonActive]}
          onPress={toggleTracking}
        >
          <Text
            style={[styles.buttonText, tracking && styles.buttonTextActive]}
          >
            {tracking ? "■ Stop" : "▶ Explore"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() => {
            setSheetPlace(null);
            setSheetOpen(true);
          }}
        >
          <Text style={styles.buttonText}>＋ Place</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setPlacesOpen(true)}>
          <Text style={styles.buttonText}>Places ({notes.length})</Text>
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
  buttonActive: { backgroundColor: "#43b8b0" },
  buttonText: { color: "#e2ecea", fontWeight: "700", fontSize: 14 },
  buttonTextActive: { color: "#0b1417" },
});
