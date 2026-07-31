import type { PlaceNote } from "./db";

export interface Streaks {
  current: number;
  best: number;
}

const DAY_MS = 86_400_000;

function dayToUtcMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function localDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Streak = consecutive days with at least one newly cleared cell.
 * The current streak survives if the last active day is today or yesterday.
 */
export function computeStreaks(days: string[]): Streaks {
  if (days.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = (dayToUtcMs(days[i]) - dayToUtcMs(days[i - 1])) / DAY_MS;
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const today = localDayString(new Date());
  const yesterday = localDayString(new Date(Date.now() - DAY_MS));
  const last = days[days.length - 1];
  const current = last === today || last === yesterday ? run : 0;

  return { current, best };
}

export interface Milestone {
  label: string;
  detail: string;
  hit: boolean;
}

export function milestones(
  cellCount: number,
  notes: PlaceNote[],
  streaks: Streaks,
): Milestone[] {
  return [
    {
      label: "First steps",
      detail: "Clear your first cell",
      hit: cellCount >= 1,
    },
    {
      label: "Wanderer",
      detail: "Clear 100 cells",
      hit: cellCount >= 100,
    },
    {
      label: "Pathfinder",
      detail: "Clear 1,000 cells",
      hit: cellCount >= 1_000,
    },
    {
      label: "Cartographer",
      detail: "Clear 10,000 cells",
      hit: cellCount >= 10_000,
    },
    {
      label: "Curator",
      detail: "Save your first place",
      hit: notes.length >= 1,
    },
    {
      label: "Collector",
      detail: "Save 10 places",
      hit: notes.length >= 10,
    },
    {
      label: "On a roll",
      detail: "3-day exploring streak",
      hit: streaks.best >= 3,
    },
    {
      label: "Habit formed",
      detail: "7-day exploring streak",
      hit: streaks.best >= 7,
    },
  ];
}
