import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PlaceNote } from "../db";
import { card, colors, font } from "./theme";

interface Props {
  visible: boolean;
  notes: PlaceNote[];
  onSelect: (note: PlaceNote) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function PlacesModal({
  visible,
  notes,
  onSelect,
  onDelete,
  onClose,
}: Props) {
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
            data={notes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable style={styles.rowMain} onPress={() => onSelect(item)}>
                  <Text style={styles.name}>
                    {item.verdict === 1 ? "👍 " : "👎 "}
                    {item.name}
                  </Text>
                  {!!item.body && (
                    <Text style={styles.body} numberOfLines={2}>
                      {item.body}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.delete}
                  onPress={() => onDelete(item.id)}
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
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: font.medium,
  },
  delete: { padding: 10 },
  deleteText: { color: colors.textFaint, fontSize: 15 },
});
