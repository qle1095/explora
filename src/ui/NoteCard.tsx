import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PlaceNote } from "../db";
import { card, colors, font } from "./theme";

interface Props {
  /** The tapped saved place; null closes the card. */
  note: PlaceNote | null;
  onDelete: (id: number) => void;
  onClose: () => void;
}

function savedOn(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * What a saved pin shows when you tap it: the verdict, the note you wrote,
 * and when you were there. Read-only — editing lives in the save sheet.
 */
export function NoteCard({ note, onDelete, onClose }: Props) {
  if (!note) return null;
  const worthIt = note.verdict === 1;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={[styles.verdict, !worthIt && styles.verdictNo]}>
          <Text style={styles.verdictText}>
            {worthIt ? "👍 Worth going" : "👎 Not worth it"}
          </Text>
        </View>
        <Text style={styles.name}>{note.name}</Text>
        {note.body ? (
          <Text style={styles.body}>{note.body}</Text>
        ) : (
          <Text style={styles.noBody}>No note on this one.</Text>
        )}
        <Text style={styles.meta}>Saved {savedOn(note.created_at)}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Close</Text>
          </Pressable>
          <Pressable
            style={styles.delete}
            onPress={() => onDelete(note.id)}
            hitSlop={6}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
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
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    marginBottom: 14,
  },
  verdict: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(224, 160, 85, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  verdictNo: { backgroundColor: "rgba(92, 116, 118, 0.18)" },
  verdictText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: font.demi,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: font.bold,
    marginBottom: 8,
  },
  body: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.medium,
  },
  noBody: {
    color: colors.textFaint,
    fontSize: 15,
    fontFamily: font.medium,
    fontStyle: "italic",
  },
  meta: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: font.medium,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  secondary: {
    ...card,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: font.demi,
  },
  delete: { padding: 10 },
  deleteText: { color: colors.textFaint, fontSize: 14, fontFamily: font.demi },
});
