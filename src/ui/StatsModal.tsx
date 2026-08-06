import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PlaceNote } from "../db";
import { computeStreaks, milestones } from "../stats";
import { card, colors, font } from "./theme";

interface Props {
  visible: boolean;
  cellCount: number;
  areaKm2: number;
  earthPct: string;
  days: string[];
  notes: PlaceNote[];
  onReset: () => void;
  onClose: () => void;
}

export function StatsModal({
  visible,
  cellCount,
  areaKm2,
  earthPct,
  days,
  notes,
  onReset,
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
          <Text style={styles.journalTitle}>Explorer’s Journal</Text>
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
                {m.hit ? "🏅" : "○"}
              </Text>
              <View style={styles.milestoneText}>
                <Text style={[styles.mLabel, !m.hit && styles.mLabelPending]}>
                  {m.label}
                </Text>
                <Text style={styles.mDetail}>{m.detail}</Text>
              </View>
            </View>
          ))}
          <Pressable
            style={styles.reset}
            onPress={() =>
              Alert.alert(
                "Reset your map?",
                "All fog, trails, and stats go back to zero. Saved places are kept. This can't be undone.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset map", style: "destructive", onPress: onReset },
                ],
              )
            }
          >
            <Text style={styles.resetText}>Reset map</Text>
          </Pressable>
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
    backgroundColor: "rgba(60, 45, 25, 0.35)",
  },
  sheet: {
    ...card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    marginBottom: 6,
  },
  journalTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontFamily: font.bold,
    marginTop: 8,
  },
  section: {
    color: colors.accentDeep,
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 8,
  },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: colors.inset,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.insetBorder,
    paddingVertical: 12,
    alignItems: "center",
  },
  tileValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: font.bold,
    fontVariant: ["tabular-nums"],
  },
  tileUnit: { fontSize: 13, color: colors.textSecondary },
  tileLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
    fontFamily: font.medium,
  },
  milestone: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 12,
  },
  check: { color: colors.textFaint, fontSize: 16, width: 24, textAlign: "center" },
  checkHit: { color: colors.gold },
  milestoneText: { flex: 1 },
  mLabel: { color: colors.textPrimary, fontSize: 14, fontFamily: font.demi },
  mLabelPending: { color: colors.textFaint },
  mDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: font.medium,
  },
  reset: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(247, 127, 95, 0.6)",
    alignItems: "center",
    paddingVertical: 12,
  },
  resetText: { color: colors.coral, fontSize: 14, fontFamily: font.bold },
});
