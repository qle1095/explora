import { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PlaceNote } from "../db";
import { metersBetween, type LngLat } from "../fog";
import { bearingLabel, distanceLabel } from "../places";
import { card, colors, font, space, type } from "./theme";

interface Props {
  visible: boolean;
  notes: PlaceNote[];
  /** Where the user is, for distance-sorting. Absent = newest first. */
  near?: LngLat;
  onSelect: (note: PlaceNote) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function PlacesModal({
  visible,
  notes,
  near,
  onSelect,
  onDelete,
  onClose,
}: Props) {
  /**
   * Nearest first. A saved place two streets away and one on another
   * continent are not equally useful when you're standing somewhere — and
   * an imported guide is worthless if you can't see which of it is reachable
   * right now. Without a fix we can't rank, so newest-first is the honest
   * fallback rather than an arbitrary order.
   */
  const rows = useMemo<
    { note: PlaceNote; distM?: number; bearing?: string }[]
  >(() => {
    if (!near) return notes.map((note) => ({ note }));
    return notes
      .map((note) => ({
        note,
        distM: metersBetween(near, [note.lng, note.lat]),
        bearing: bearingLabel(near[1], near[0], note.lat, note.lng),
      }))
      .sort((a, b) => a.distM - b.distM);
  }, [notes, near]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>My places</Text>
        {notes.length === 0 ? (
          <Text style={styles.empty}>
            Nothing saved yet. Long-press the map or search to add the places
            worth remembering.
          </Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => String(row.note.id)}
            renderItem={({ item: row }) => (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => onSelect(row.note)}
                >
                  <Text style={styles.name}>
                    {row.note.verdict === 1 ? "👍 " : "👎 "}
                    {row.note.name}
                  </Text>
                  {row.distM != null && (
                    <Text style={styles.meta}>
                      {distanceLabel(row.distM)} {row.bearing}
                    </Text>
                  )}
                  {!!row.note.body && (
                    <Text style={styles.body} numberOfLines={2}>
                      {row.note.body}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.delete}
                  onPress={() => onDelete(row.note.id)}
                  hitSlop={8}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </Pressable>
              </View>
            )}
          />
        )}
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
    paddingBottom: 36,
    maxHeight: "70%",
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 19,
    fontFamily: font.bold,
    marginBottom: 8,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
    fontFamily: font.medium,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.insetBorder,
  },
  rowMain: { flex: 1, paddingVertical: 12 },
  name: { color: colors.textPrimary, fontSize: 15, fontFamily: font.demi },
  // Same role as the check-in list's meta line, so the two screens read as
  // one system rather than two lists that happen to show places.
  meta: { ...type.meta, color: colors.textFaint, marginTop: space.xs / 2 },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: font.medium,
  },
  delete: { padding: 10 },
  deleteText: { color: colors.textFaint, fontSize: 15 },
});
