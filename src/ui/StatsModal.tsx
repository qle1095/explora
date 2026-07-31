import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PlaceNote } from "../db";
import { computeStreaks, milestones } from "../stats";

interface Props {
  visible: boolean;
  cellCount: number;
  areaKm2: number;
  earthPct: string;
  days: string[];
  notes: PlaceNote[];
  onClose: () => void;
}

export function StatsModal({
  visible,
  cellCount,
  areaKm2,
  earthPct,
  days,
  notes,
  onClose,
}: Props) {
  if (!visible) return null;

  const streaks = computeStreaks(days);
  const stones = milestones(cellCount, notes, streaks);
  const yes = notes.filter((n) => n.verdict === 1).length;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>EXPLORATION</Text>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{cellCount.toLocaleString()}</Text>
              <Text style={styles.tileLabel}>cells cleared</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{areaKm2.toFixed(1)}</Text>
              <Text style={styles.tileLabel}>km² uncovered</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{earthPct}%</Text>
              <Text style={styles.tileLabel}>of Earth</Text>
            </View>
          </View>

          <Text style={styles.section}>STREAK</Text>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>
                {streaks.current}
                <Text style={styles.tileUnit}> d</Text>
              </Text>
              <Text style={styles.tileLabel}>current streak</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>
                {streaks.best}
                <Text style={styles.tileUnit}> d</Text>
              </Text>
              <Text style={styles.tileLabel}>best streak</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{days.length}</Text>
              <Text style={styles.tileLabel}>days exploring</Text>
            </View>
          </View>

          <Text style={styles.section}>COLLECTION</Text>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{notes.length}</Text>
              <Text style={styles.tileLabel}>places saved</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{yes}</Text>
              <Text style={styles.tileLabel}>worth going</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{notes.length - yes}</Text>
              <Text style={styles.tileLabel}>skip it</Text>
            </View>
          </View>

          <Text style={styles.section}>MILESTONES</Text>
          {stones.map((m) => (
            <View key={m.label} style={styles.milestone}>
              <Text style={[styles.check, m.hit && styles.checkHit]}>
                {m.hit ? "●" : "○"}
              </Text>
              <View style={styles.milestoneText}>
                <Text style={[styles.mLabel, !m.hit && styles.mLabelPending]}>
                  {m.label}
                </Text>
                <Text style={styles.mDetail}>{m.detail}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#132125",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(67,184,176,0.25)",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2c4247",
    marginBottom: 6,
  },
  section: {
    color: "#43b8b0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
  },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: "#0d181b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24393d",
    paddingVertical: 12,
    alignItems: "center",
  },
  tileValue: {
    color: "#e2ecea",
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tileUnit: { fontSize: 13, color: "#92a7a7" },
  tileLabel: { color: "#92a7a7", fontSize: 11, marginTop: 3 },
  milestone: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 12,
  },
  check: { color: "#2c4247", fontSize: 16, width: 20, textAlign: "center" },
  checkHit: { color: "#43b8b0" },
  milestoneText: { flex: 1 },
  mLabel: { color: "#e2ecea", fontSize: 14, fontWeight: "600" },
  mLabelPending: { color: "#5c7476" },
  mDetail: { color: "#92a7a7", fontSize: 12 },
});
