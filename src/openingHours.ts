/**
 * A deliberately small reader for OSM `opening_hours`.
 *
 * The real grammar is enormous — public holidays, week numbers, sunset
 * offsets, fallback rules. Sampling Shinjuku and Nob Hill, 129 of 138 tagged
 * values are nothing more than an optional day spec plus `HH:MM-HH:MM`
 * ranges, so that is exactly what this parses. Anything else returns null.
 *
 * Null means "don't claim anything". A wrong "Open now" badge sends a
 * traveler across a city to a locked door, which is worse than no badge.
 */

/**
 * How far a real timezone may sit from its longitude's solar time before we
 * stop believing the device clock. Political zones deviate a lot — western
 * China runs ~3h ahead of solar, Spain and western France ~2h, Nome ~3h — so
 * the bar has to clear those. A phone still on another continent's time is
 * out by far more: New York time while standing in Tokyo is ~10h off.
 */
const MAX_PLAUSIBLE_OFFSET_H = 4;

/**
 * Does the device clock plausibly reflect local time where this place is?
 *
 * `opening_hours` is expressed in the shop's local time, and we evaluate it
 * with the phone's clock. That's correct once a traveler's phone picks up
 * local time — and wrong all day if it hasn't (airplane mode, manual
 * timezone, an eSIM that never resynced). When the two disagree wildly we
 * withhold the verdict instead of asserting a wrong one.
 */
export function clockMatchesPlace(lng: number, now = new Date()): boolean {
  const deviceOffsetH = -now.getTimezoneOffset() / 60;
  const solarOffsetH = lng / 15;
  let diff = Math.abs(deviceOffsetH - solarOffsetH);
  // The date line: +11 and -11 are two hours apart, not twenty-two.
  if (diff > 12) diff = 24 - diff;
  return diff <= MAX_PLAUSIBLE_OFFSET_H;
}

/** Day tokens to JS `getDay()` numbers. */
const DAY_INDEX: Record<string, number> = {
  Su: 0,
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6,
};

const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

interface Rule {
  days: Set<number>;
  /** Minutes from midnight. `end <= start` means the range crosses midnight. */
  ranges: [number, number][];
  closed: boolean;
}

/** "Mo-Fr", "Sa,Su", "We" → the set of days it covers. Null if unrecognised. */
function parseDays(spec: string): Set<number> | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const match = /^([A-Z][a-z])(?:-([A-Z][a-z]))?$/.exec(part.trim());
    if (!match) return null;
    const from = DAY_INDEX[match[1]];
    if (from === undefined) return null;
    if (!match[2]) {
      days.add(from);
      continue;
    }
    const to = DAY_INDEX[match[2]];
    if (to === undefined) return null;
    // Wraps: Sa-Su is Saturday and Sunday, not an empty range.
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
  }
  return days;
}

/** "11:00-14:00,17:00-22:00" → minute ranges. Null if unrecognised. */
function parseRanges(spec: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  for (const part of spec.split(",")) {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part.trim());
    if (!match) return null;
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    if (start > 24 * 60 || end > 24 * 60) return null;
    ranges.push([start, end]);
  }
  return ranges.length ? ranges : null;
}

function parseRule(raw: string): Rule | null {
  const text = raw.trim();
  if (!text) return null;

  const tokens = text.split(/\s+/);
  let days = ALL_DAYS;
  let rest = text;
  // A leading day spec is optional — a bare "08:00-22:00" means every day.
  if (tokens.length > 1 && /^[A-Z][a-z]/.test(tokens[0])) {
    const parsed = parseDays(tokens[0]);
    if (!parsed) return null;
    days = parsed;
    rest = tokens.slice(1).join(" ");
  }

  if (/^(off|closed)$/i.test(rest)) return { days, ranges: [], closed: true };

  const ranges = parseRanges(rest);
  if (!ranges) return null;
  return { days, ranges, closed: false };
}

/**
 * Is this place open right now? True/false when we can tell, null when the
 * spec uses anything outside the subset above.
 */
export function isOpenNow(spec: string, now = new Date()): boolean | null {
  const text = spec.trim();
  if (!text) return null;
  if (text === "24/7") return true;

  const rules: Rule[] = [];
  for (const raw of text.split(";")) {
    if (!raw.trim()) continue;
    const rule = parseRule(raw);
    // One unreadable clause makes the whole spec untrustworthy — a rule we
    // skipped could be the very "Su off" that closes the place today.
    if (!rule) return null;
    rules.push(rule);
  }
  if (!rules.length) return null;

  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const mins = now.getHours() * 60 + now.getMinutes();

  // Later rules override earlier ones, which is how "Mo-Fr 9-17; Sa off" reads.
  let open = false;
  for (const rule of rules) {
    if (rule.closed) {
      if (rule.days.has(today)) open = false;
      continue;
    }
    if (rule.days.has(today)) {
      for (const [start, end] of rule.ranges) {
        const within =
          end > start ? mins >= start && mins < end : mins >= start;
        if (within) open = true;
      }
    }
    // A bar open 20:00-02:00 on Friday is still open at 01:00 on Saturday.
    if (rule.days.has(yesterday)) {
      for (const [start, end] of rule.ranges) {
        if (end <= start && mins < end) open = true;
      }
    }
  }
  return open;
}
