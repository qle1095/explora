import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  onDone: () => void;
}

const POINTS: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: "◆",
    title: "The world starts covered in fog",
    body: "Going somewhere clears it — automatically. Your map becomes a lifetime record of everywhere you've been.",
  },
  {
    icon: "✦",
    title: "Save the places worth remembering",
    body: "Worth going, yes or no — plus a private note only you can see.",
  },
  {
    icon: "●",
    title: "Your map is yours",
    body: "Nothing is shared unless you choose to share it. Explora never shows where you are right now.",
  },
];

export function Onboarding({ onDone }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>EXPLORA</Text>
      <Text style={styles.tagline}>Where have you been?</Text>

      <View style={styles.points}>
        {POINTS.map((p) => (
          <View key={p.title} style={styles.point}>
            <Text style={styles.icon}>{p.icon}</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{p.title}</Text>
              <Text style={styles.pointBody}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable style={styles.cta} onPress={onDone}>
        <Text style={styles.ctaText}>Start exploring</Text>
      </Pressable>
      <Text style={styles.finePrint}>
        Explora will ask for location access — that's what clears the fog.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0b1417",
    paddingHorizontal: 28,
    paddingTop: 120,
    paddingBottom: 60,
  },
  wordmark: {
    color: "#43b8b0",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 8,
  },
  tagline: { color: "#92a7a7", fontSize: 16, marginTop: 6 },
  points: { flex: 1, justifyContent: "center", gap: 28 },
  point: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  icon: { color: "#43b8b0", fontSize: 18, width: 24, marginTop: 2 },
  pointText: { flex: 1 },
  pointTitle: { color: "#e2ecea", fontSize: 16, fontWeight: "700" },
  pointBody: { color: "#92a7a7", fontSize: 14, lineHeight: 20, marginTop: 4 },
  cta: {
    backgroundColor: "#43b8b0",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 15,
  },
  ctaText: { color: "#0b1417", fontSize: 16, fontWeight: "700" },
  finePrint: {
    color: "#5c7476",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
