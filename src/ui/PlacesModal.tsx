import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PlaceNote } from "../db";

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
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#132125",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "rgba(67,184,176,0.25)",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2c4247",
    marginBottom: 14,
  },
  title: { color: "#e2ecea", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  empty: { color: "#92a7a7", fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1c2f33",
  },
  rowMain: { flex: 1, paddingVertical: 12 },
  name: { color: "#e2ecea", fontSize: 15, fontWeight: "600" },
  body: { color: "#92a7a7", fontSize: 13, marginTop: 2 },
  delete: { padding: 10 },
  deleteText: { color: "#5c7476", fontSize: 15 },
});
