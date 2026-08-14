import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  cachedNearby,
  distanceLabel,
  fetchNearby,
  searchPlaces,
  type PlaceResult,
} from "../places";
import { card, colors, font, space, status, type } from "./theme";

interface Props {
  visible: boolean;
  /** Prefilled place (from long-press reverse geocode); null = search mode. */
  place: PlaceResult | null;
  near?: [number, number];
  onSave: (place: PlaceResult, body: string, verdict: boolean) => void;
  onClose: () => void;
}

/** Rough age of a cached lookup. Precision past "a few days" helps nobody. */
function agoLabel(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 60) return "just now";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function open(url: string) {
  // A dead tel:/https: handler shouldn't take the sheet down with it.
  void Linking.openURL(url).catch(() => {});
}

const WHEELCHAIR_LABEL: Record<string, string> = {
  yes: "♿ Step-free access",
  limited: "♿ Limited step-free access",
  no: "♿ No step-free access",
};

/**
 * What OSM knows about a place beyond its name. Every field is optional and
 * frequently missing, so each renders only when present — and the block
 * disappears entirely rather than showing a scaffold of empty labels.
 */
function PlaceFacts({ place }: { place: PlaceResult }) {
  const wheelchair = place.wheelchair
    ? WHEELCHAIR_LABEL[place.wheelchair]
    : undefined;
  const hasAny =
    place.openNow !== undefined ||
    place.hours ||
    place.address ||
    wheelchair ||
    place.phone ||
    place.website;
  if (!hasAny) return null;

  return (
    <View style={styles.facts}>
      {(place.openNow !== undefined || !!place.hours) && (
        <View style={styles.factLine}>
          {place.openNow !== undefined && (
            <View
              style={[styles.openChip, !place.openNow && styles.closedChip]}
            >
              <Text
                style={[
                  styles.openChipText,
                  !place.openNow && styles.closedChipText,
                ]}
              >
                {place.openNow ? "OPEN" : "CLOSED"}
              </Text>
            </View>
          )}
          {/* The raw spec earns its place: "Mo-Sa 11:00-22:00" answers
              "will it still be open later", which a badge cannot. */}
          {!!place.hours && (
            <Text style={styles.factText} numberOfLines={2}>
              {place.hours}
            </Text>
          )}
        </View>
      )}
      {!!place.address && <Text style={styles.factText}>{place.address}</Text>}
      {!!wheelchair && <Text style={styles.factText}>{wheelchair}</Text>}
      {(!!place.phone || !!place.website) && (
        <View style={styles.actionRow}>
          {!!place.phone && (
            <Pressable
              style={styles.action}
              onPress={() => open(`tel:${place.phone!.replace(/\s+/g, "")}`)}
            >
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
          )}
          {!!place.website && (
            <Pressable
              style={styles.action}
              onPress={() =>
                open(
                  /^https?:\/\//i.test(place.website!)
                    ? place.website!
                    : `https://${place.website}`,
                )
              }
            >
              <Text style={styles.actionText}>Website</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export function NoteSheet({ visible, place, near, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<PlaceResult | null>(place);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [nearby, setNearby] = useState<PlaceResult[]>([]);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
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
    setNearbyFailed(false);

    // Show what we already know instantly, then let the network correct it.
    const cached = cachedNearby(near[1], near[0]);
    setNearby(cached?.places ?? []);
    setCachedAt(cached?.cachedAt ?? null);
    setSearching(true);

    fetchNearby(near[1], near[0])
      .then((places) => {
        if (cancelled) return;
        setNearby(places);
        setCachedAt(null);
      })
      .catch(() => {
        // Only an error if we had nothing to show in the first place.
        if (!cancelled && !cached) setNearbyFailed(true);
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
    setSearchFailed(false);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query.trim(), near));
      } catch {
        // Without this the rejection escapes the setTimeout entirely — an
        // unhandled promise rejection, and a user left staring at "no results"
        // that actually means "no network".
        setResults([]);
        setSearchFailed(true);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, near, searchKey]);

  // Ranking already pushes errands to the back; this just says so out loud,
  // so a konbini below a museum reads as deliberate rather than as a bug.
  const listRows = useMemo<(PlaceResult | { divider: string })[]>(() => {
    const places = query.trim().length < 3 ? nearby : results;
    const rows: (PlaceResult | { divider: string })[] = [];
    let dividerPlaced = false;
    for (const place of places) {
      if (place.everyday && !dividerPlaced) {
        rows.push({ divider: "EVERYDAY" });
        dividerPlaced = true;
      }
      rows.push(place);
    }
    return rows;
  }, [nearby, results, query]);

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
            {/* Only when there's nothing to look at — a spinner above a full
                list of cached places just makes it look broken. */}
            {searching && nearby.length === 0 && (
              <ActivityIndicator color="#43b8b0" />
            )}
            {query.trim().length < 3 && nearby.length > 0 && (
              <Text style={styles.sectionLabel}>NEAR YOU</Text>
            )}
            {query.trim().length < 3 && cachedAt !== null && (
              <Pressable
                style={styles.staleRow}
                onPress={() => setReloadKey((k) => k + 1)}
                disabled={searching}
              >
                {/* Same cached list, two different truths: still trying, or
                    given up. Saying "offline" while a request is in flight
                    would be a guess. */}
                <Text style={styles.staleText}>
                  {searching
                    ? `Showing what was here ${agoLabel(cachedAt)} · checking for updates…`
                    : `Offline — showing what was here ${agoLabel(cachedAt)}. Tap to retry.`}
                </Text>
              </Pressable>
            )}
            {query.trim().length >= 3 && searchFailed && !searching && (
              <Pressable
                style={styles.retryRow}
                onPress={() => setSearchKey((k) => k + 1)}
              >
                <Text style={styles.retryText}>
                  Couldn’t search — you may be offline. Tap to retry.
                </Text>
              </Pressable>
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
              data={listRows}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(row) =>
                "divider" in row
                  ? `divider:${row.divider}`
                  : `${row.name}:${row.lat},${row.lng}`
              }
              style={styles.results}
              renderItem={({ item: row }) => {
                if ("divider" in row) {
                  return (
                    <Text style={[styles.sectionLabel, styles.innerLabel]}>
                      {row.divider}
                    </Text>
                  );
                }
                const item = row;
                const rightHere = item.distM != null && item.distM <= 60;
                // Enriched nearby rows carry `kind`; search hits don't, and
                // fall back to the plain subtitle.
                const meta = item.kind
                  ? [
                      item.kind,
                      item.distM != null &&
                        `${distanceLabel(item.distM)} ${item.bearing ?? ""}`.trim(),
                      item.level,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : item.detail;

                return (
                  <Pressable
                    style={[styles.result, rightHere && styles.resultHere]}
                    onPress={() => setSelected(item)}
                  >
                    {!!item.emoji && (
                      <Text style={styles.resultIcon}>{item.emoji}</Text>
                    )}
                    <View style={styles.resultBody}>
                      <View style={styles.resultTopLine}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {rightHere && (
                          <Text style={styles.hereTag}>RIGHT HERE</Text>
                        )}
                      </View>
                      {!!item.localName && (
                        <Text style={styles.resultLocal} numberOfLines={1}>
                          {item.localName}
                        </Text>
                      )}
                      <Text style={styles.resultDetail} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                    {item.openNow !== undefined && (
                      <View
                        style={[
                          styles.openChip,
                          !item.openNow && styles.closedChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.openChipText,
                            !item.openNow && styles.closedChipText,
                          ]}
                        >
                          {item.openNow ? "OPEN" : "CLOSED"}
                        </Text>
                      </View>
                    )}
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
            {!!selected.localName && (
              <Text style={styles.localTitle}>{selected.localName}</Text>
            )}
            {!!selected.detail && (
              <Text style={styles.subtitle}>{selected.detail}</Text>
            )}
            <PlaceFacts place={selected} />
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
  // The in-list divider is a quieter sibling of NEAR YOU — it separates,
  // it doesn't compete with the rows it introduces.
  innerLabel: {
    color: colors.textFaint,
    marginTop: space.lg,
    marginBottom: space.xs,
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
  // Quieter than the retry row: this is a working state with real results
  // below it, not an error. It informs, it doesn't alarm.
  staleRow: {
    marginTop: space.sm,
    borderRadius: 12,
    backgroundColor: colors.inset,
    borderWidth: 1,
    borderColor: colors.insetBorder,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  staleText: { ...type.meta, color: colors.textSecondary },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.insetBorder,
  },
  resultHere: {
    backgroundColor: status.openBg,
    borderRadius: 12,
    paddingHorizontal: space.sm,
    borderBottomWidth: 0,
    marginTop: space.xs,
  },
  // Fixed-width leading slot so every name starts on the same x — the row
  // list is scanned vertically, and ragged left edges kill that.
  resultIcon: { width: 22, fontSize: 17, textAlign: "center" },
  resultBody: { flex: 1 },
  resultTopLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hereTag: {
    ...type.chip,
    color: colors.accentDeep,
    letterSpacing: 1,
  },
  resultName: {
    ...type.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  resultLocal: {
    ...type.sub,
    color: colors.textSecondary,
    marginTop: 1,
  },
  resultDetail: {
    ...type.meta,
    color: colors.textFaint,
    marginTop: 2,
  },
  openChip: {
    backgroundColor: status.openBg,
    borderRadius: 999,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  closedChip: { backgroundColor: status.closedBg },
  openChipText: {
    ...type.chip,
    color: status.openText,
    letterSpacing: 0.6,
  },
  closedChipText: { color: status.closedText },
  localTitle: {
    ...type.sub,
    color: colors.textSecondary,
    marginTop: -2,
  },
  facts: {
    backgroundColor: colors.inset,
    borderColor: colors.insetBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: space.md,
    marginTop: space.md,
    gap: space.sm,
  },
  factLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  factText: { ...type.meta, color: colors.textSecondary, flexShrink: 1 },
  actionRow: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  action: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  actionText: { ...type.chip, color: colors.accentDeep, letterSpacing: 0.6 },
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
