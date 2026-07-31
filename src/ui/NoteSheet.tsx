import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { searchPlaces, type PlaceResult } from "../places";

interface Props {
  visible: boolean;
  /** Prefilled place (from long-press reverse geocode); null = search mode. */
  place: PlaceResult | null;
  near?: [number, number];
  onSave: (place: PlaceResult, body: string, verdict: boolean) => void;
  onClose: () => void;
}

export function NoteSheet({ visible, place, near, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<PlaceResult | null>(place);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [body, setBody] = useState("");
  const [verdict, setVerdict] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelected(place);
    setQuery("");
    setResults([]);
    setBody("");
    setVerdict(true);
  }, [place, visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query.trim(), near));
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, near]);

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.overlay}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {!selected ? (
          <>
            <Text style={styles.title}>Add a place</Text>
            <TextInput
              style={styles.input}
              placeholder="Search for a place…"
              placeholderTextColor="#5c7476"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {searching && <ActivityIndicator color="#43b8b0" />}
            <FlatList
              data={results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => `${item.lat},${item.lng}`}
              style={styles.results}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.result}
                  onPress={() => setSelected(item)}
                >
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultDetail}>{item.detail}</Text>
                </Pressable>
              )}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>{selected.name}</Text>
            {!!selected.detail && (
              <Text style={styles.subtitle}>{selected.detail}</Text>
            )}
            <View style={styles.verdictRow}>
              <Pressable
                style={[styles.verdict, verdict && styles.verdictYes]}
                onPress={() => setVerdict(true)}
              >
                <Text
                  style={[
                    styles.verdictText,
                    verdict && styles.verdictTextActive,
                  ]}
                >
                  👍 Worth going
                </Text>
              </Pressable>
              <Pressable
                style={[styles.verdict, !verdict && styles.verdictNo]}
                onPress={() => setVerdict(false)}
              >
                <Text
                  style={[
                    styles.verdictText,
                    !verdict && styles.verdictTextActive,
                  ]}
                >
                  👎 Skip it
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Private note — why is this place worth remembering?"
              placeholderTextColor="#5c7476"
              value={body}
              onChangeText={setBody}
              multiline
              autoFocus
            />
            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={onClose}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primary}
                onPress={() => onSave(selected, body.trim(), verdict)}
              >
                <Text style={styles.primaryText}>Save place</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
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
    maxHeight: "75%",
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
  title: { color: "#e2ecea", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#92a7a7", fontSize: 13, marginTop: 2 },
  input: {
    backgroundColor: "#0d181b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24393d",
    color: "#e2ecea",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  noteInput: { minHeight: 90, textAlignVertical: "top" },
  results: { marginTop: 8 },
  result: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1c2f33",
  },
  resultName: { color: "#e2ecea", fontSize: 15, fontWeight: "600" },
  resultDetail: { color: "#92a7a7", fontSize: 12, marginTop: 1 },
  verdictRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  verdict: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24393d",
    alignItems: "center",
    paddingVertical: 10,
  },
  verdictYes: { backgroundColor: "#43b8b0", borderColor: "#43b8b0" },
  verdictNo: { backgroundColor: "#5c4a2f", borderColor: "#8a6b3f" },
  verdictText: { color: "#92a7a7", fontSize: 14, fontWeight: "600" },
  verdictTextActive: { color: "#0b1417" },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  primary: {
    flex: 1,
    backgroundColor: "#43b8b0",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  primaryText: { color: "#0b1417", fontWeight: "700", fontSize: 15 },
  secondary: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2c4247",
  },
  secondaryText: { color: "#92a7a7", fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.4 },
});
