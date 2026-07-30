import { useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import type { NativeSyntheticEvent } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type PressEvent,
} from "@maplibre/maplibre-react-native";

import {
  buildFogShape,
  exploredStats,
  revealAt,
  seedCells,
} from "./src/fog";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const START_CENTER: [number, number] = [-122.4193, 37.7893];

export default function App() {
  const [cells, setCells] = useState(seedCells);

  const fogShape = useMemo(() => buildFogShape(cells), [cells]);
  const stats = useMemo(() => exploredStats(cells), [cells]);

  // M0 demo stand-in for GPS: tap anywhere to reveal that spot.
  const handlePress = (event: NativeSyntheticEvent<PressEvent>) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    setCells((prev) => revealAt(prev, lat, lng));
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} mapStyle={MAP_STYLE} onPress={handlePress}>
        <Camera
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
      </MapView>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudTitle}>EXPLORA</Text>
        <Text style={styles.hudStat}>
          {stats.count.toLocaleString()} cells · {stats.areaKm2.toFixed(1)} km²
          · {stats.earthPct}% of Earth
        </Text>
        <Text style={styles.hudHint}>tap the map to reveal</Text>
      </View>
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
});
