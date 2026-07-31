#!/usr/bin/env node
/**
 * Keyboard walking simulator for the iOS Simulator.
 *
 *   node scripts/walk.js [lat] [lng]
 *
 * Arrow keys / WASD to walk, hold Shift(+WASD) or use ARROWS with key-repeat
 * to keep moving. "+" / "-" change step size, "p" prints the position,
 * "q" or Ctrl+C quits. Each step calls `simctl location set`, which Explora
 * receives as a GPS fix (its tracker registers moves >= ~10 m).
 */
const { execFile } = require("node:child_process");
const readline = require("node:readline");

let lat = Number(process.argv[2] ?? 37.7793);
let lng = Number(process.argv[3] ?? -122.4193);
let stepM = 15; // meters per keypress
let pending = false;
let dirty = false;

function push() {
  // Coalesce rapid keypresses so simctl calls never pile up.
  if (pending) {
    dirty = true;
    return;
  }
  pending = true;
  execFile(
    "xcrun",
    ["simctl", "location", "booted", "set", `${lat.toFixed(6)},${lng.toFixed(6)}`],
    (err) => {
      pending = false;
      if (err) {
        console.error("simctl failed — is a simulator booted?");
        process.exit(1);
      }
      if (dirty) {
        dirty = false;
        push();
      }
    },
  );
}

function move(dLatM, dLngM) {
  lat += dLatM / 111_320;
  lng += dLngM / (111_320 * Math.cos((lat * Math.PI) / 180));
  process.stdout.write(
    `\r  ${lat.toFixed(6)}, ${lng.toFixed(6)}   step ${stepM}m   `,
  );
  push();
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on("keypress", (_ch, key) => {
  if (!key) return;
  const boost = key.shift ? 4 : 1;
  const m = stepM * boost;
  switch (key.name) {
    case "up":
    case "w":
      move(m, 0);
      break;
    case "down":
    case "s":
      move(-m, 0);
      break;
    case "left":
    case "a":
      move(0, -m);
      break;
    case "right":
    case "d":
      move(0, m);
      break;
    case "+":
    case "=":
      stepM = Math.min(stepM * 2, 500);
      move(0, 0);
      break;
    case "-":
      stepM = Math.max(Math.round(stepM / 2), 5);
      move(0, 0);
      break;
    case "p":
      console.log(`\n  https://maps.apple.com/?ll=${lat},${lng}`);
      break;
    case "q":
      quit();
      break;
    case "c":
      if (key.ctrl) quit();
      break;
  }
});

function quit() {
  console.log("\n  stopped — simulated location stays at last position");
  process.exit(0);
}

console.log(
  "  walk with ↑↓←→ or WASD (hold Shift = 4x) · +/- step size · p = position link · q = quit\n",
);
move(0, 0);
