import { openDatabaseSync } from "expo-sqlite";

export interface PlaceNote {
  id: number;
  name: string;
  lat: number;
  lng: number;
  body: string;
  created_at: number;
}

const db = openDatabaseSync("explora.db");

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS cells (
    h3 TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    points TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export function loadCells(): string[] {
  return db
    .getAllSync<{ h3: string }>("SELECT h3 FROM cells")
    .map((r) => r.h3);
}

export function saveCells(h3s: Iterable<string>): void {
  const now = Date.now();
  db.withTransactionSync(() => {
    for (const h3 of h3s) {
      db.runSync(
        "INSERT OR IGNORE INTO cells (h3, first_seen) VALUES (?, ?)",
        [h3, now],
      );
    }
  });
}

export function saveTrail(
  startedAt: number,
  points: [number, number][],
): void {
  db.runSync(
    "INSERT INTO trails (started_at, ended_at, points) VALUES (?, ?, ?)",
    [startedAt, Date.now(), JSON.stringify(points)],
  );
}

export function loadTrails(): [number, number][][] {
  return db
    .getAllSync<{ points: string }>("SELECT points FROM trails")
    .map((r) => JSON.parse(r.points) as [number, number][]);
}

export function addNote(
  name: string,
  lat: number,
  lng: number,
  body: string,
): void {
  db.runSync(
    "INSERT INTO notes (name, lat, lng, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [name, lat, lng, body, Date.now()],
  );
}

export function listNotes(): PlaceNote[] {
  return db.getAllSync<PlaceNote>(
    "SELECT * FROM notes ORDER BY created_at DESC",
  );
}

export function deleteNote(id: number): void {
  db.runSync("DELETE FROM notes WHERE id = ?", [id]);
}
