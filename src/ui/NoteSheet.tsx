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

import { nearbyPlaces, searchPlaces, type PlaceResult } from "../places";
import { card, colors, font } from "./theme";

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
  const [nearby, setNearby] = useState<PlaceResult[]>([]);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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

  // Checkpoint mode: no prefilled place — immediately look up what's
  // around the user right now.
  useEffect(() => {
    if (!visible || place || !near) return;
    let cancelled = false;
    setSearching(true);
    setNearbyFailed(false);
    nearbyPlaces(near[1], near[0])
      .then((r) => {
        if (!cancelled) setNearby(r);
      })
      .catch(() => {
        if (!cancelled) {
          setNearby([]);
          setNearbyFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, place, near, reloadKey]);

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
            <Text style={styles.title}>Check in</Text>
            <TextInput
              style={styles.input}
              placeholder="Search, or type a name to add it yourself…"
              placeholderTextColor="#5c7476"
              value={query}
              onChangeText={setQuery}
            />
            {searching && <ActivityIndicator color="#43b8b0" />}
            {query.trim().length < 3 && nearby.length > 0 && (
              <Text style={styles.sectionLabel}>NEAR YOU</Text>
            )}
            {query.trim().length < 3 && nearbyFailed && !searching && (
              <Pressable
                style={styles.retryRow}
                onPress={() => setReloadKey((k) => k + 1)}
              >
                <Text style={styles.retryText}>
                  Couldn’t load nearby places. Tap to retry.
                </Text>
              </Pressable>
            )}
            <FlatList
              data={query.trim().length < 3 ? nearby : results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => `${item.name}:${item.lat},${item.lng}`}
              style={styles.results}
              renderItem={({ item }) => {
                const rightHere = item.distM != null && item.distM <= 60;
                return (
                  <Pressable
                    style={[styles.result, rightHere && styles.resultHere]}
                    onPress={() => setSelected(item)}
                  >
                    <Text style={styles.resultName}>
                      {item.name}
                      {rightHere && (
                        <Text style={styles.hereTag}>   RIGHT HERE</Text>
                      )}
                    </Text>
                    <Text style={styles.resultDetail}>{item.detail}</Text>
                  </Pressable>
                );
              }}
            />
            {query.trim().length > 0 && near && (
              <Pressable
                style={styles.customRow}
                onPress={() =>
                  setSelected({
                    name: query.trim(),
                    detail: "Custom place — added by you",
                    lat: near[1],
                    lng: near[0],
                  })
                }
              >
                <Text style={styles.customText}>
                  ＋ Add “{query.trim()}” at my location
                </Text>
              </Pressable>
            )}
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
    backgroundColor: "rgba(60, 45, 25, 0.35)",
  },
  sheet: {
    ...card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "75%",
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    marginBottom: 14,
  },
  title: { color: colors.textPrimary, fontSize: 19, fontFamily: font.bold },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: font.medium,
  },
  input: {
    backgroundColor: colors.inset,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.insetBorder,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: font.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  noteInput: { minHeight: 90, textAlignVertical: "top" },
  results: { marginTop: 8 },
  sectionLabel: {
    color: colors.accentDeep,
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 1.5,
    marginTop: 12,
  },
  customRow: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 11,
    alignItems: "center",
  },
  customText: { color: colors.accentDeep, fontSize: 14, fontFamily: font.demi },
  retryRow: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.coral,
    paddingVertical: 11,
    alignItems: "center",
  },
  retryText: { color: colors.textSecondary, fontSize: 13, fontFamily: font.demi },
  result: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.insetBorder,
  },
  resultHere: {
    backgroundColor: "rgba(92, 184, 174, 0.14)",
    borderRadius: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    marginTop: 4,
  },
  hereTag: {
    color: colors.accentDeep,
    fontSize: 10,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  resultName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: font.demi,
  },
  resultDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
    fontFamily: font.medium,
  },
  verdictRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  verdict: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.insetBorder,
    alignItems: "center",
    paddingVertical: 10,
  },
  verdictYes: { backgroundColor: colors.accent, borderColor: colors.accentDeep },
  verdictNo: { backgroundColor: colors.coral, borderColor: "#d5643f" },
  verdictText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: font.demi,
  },
  verdictTextActive: { color: colors.onAccent },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  primary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.accentDeep,
  },
  primaryText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15 },
  secondary: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontFamily: font.demi,
    fontSize: 15,
  },
  disabled: { opacity: 0.4 },
});
