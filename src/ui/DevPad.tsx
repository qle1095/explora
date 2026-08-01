import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { devWalkTo } from "../devWalk";

const STEP_M = 9;
const REPEAT_MS = 130;

interface Props {
  /** Where walking starts from the first time a button is pressed. */
  origin: [number, number] | null;
}

/** Dev-build-only on-screen walker: tap or hold to move the mock GPS. */
export function DevPad({ origin }: Props) {
  const pos = useRef<{ lat: number; lng: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = (dLatM: number, dLngM: number) => {
    if (!pos.current) {
      const [lng, lat] = origin ?? [-122.4193, 37.7793];
      pos.current = { lat, lng };
    }
    pos.current.lat += dLatM / 111_320;
    pos.current.lng +=
      dLngM / (111_320 * Math.cos((pos.current.lat * Math.PI) / 180));
    devWalkTo(pos.current.lat, pos.current.lng);
  };

  const hold = (dLatM: number, dLngM: number) => {
    step(dLatM, dLngM);
    timer.current = setInterval(() => step(dLatM, dLngM), REPEAT_MS);
  };

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const arrow = (label: string, dLatM: number, dLngM: number) => (
    <Pressable
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
      onPressIn={() => hold(dLatM, dLngM)}
      onPressOut={release}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.pad} pointerEvents="box-none">
      <Text style={styles.tag}>DEV WALK</Text>
      <View style={styles.row}>{arrow("↑", STEP_M, 0)}</View>
      <View style={styles.row}>
        {arrow("←", 0, -STEP_M)}
        {arrow("↓", -STEP_M, 0)}
        {arrow("→", 0, STEP_M)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    position: "absolute",
    right: 16,
    bottom: 108,
    alignItems: "center",
    gap: 4,
  },
  tag: {
    color: "rgba(146,167,167,0.7)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  row: { flexDirection: "row", gap: 4 },
  key: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(11,20,23,0.75)",
    borderWidth: 1,
    borderColor: "rgba(67,184,176,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { backgroundColor: "#43b8b0" },
  keyText: { color: "#e2ecea", fontSize: 18 },
});
