'use strict';

/**
 * timezone — all streak and daily-activity maths lives here so the "learning
 * day" is computed in the USER'S local timezone (IST by default) rather than
 * server UTC. This is what stops a late-evening IST session from breaking a
 * streak by crossing the UTC date boundary.
 */

const { DEFAULT_TIMEZONE } = require('../config/constants');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Validate an IANA timezone string, falling back to the platform default. */
const resolveTimezone = (timezone) => {
  const candidate = timezone || DEFAULT_TIMEZONE;
  try {
    // Throws a RangeError for an invalid IANA identifier.
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

/** Format a Date as `YYYY-MM-DD` in the given timezone. */
const localDay = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const tz = resolveTimezone(timezone);
  // `en-CA` yields ISO-like `YYYY-MM-DD` directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/** Today's calendar day in the given timezone. */
const todayIn = (timezone = DEFAULT_TIMEZONE) => localDay(new Date(), timezone);

/** Local clock time parts, used for display and greeting logic. */
const localTimeParts = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const tz = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
};

/** Parse `YYYY-MM-DD` into a UTC-midnight Date for pure date arithmetic. */
const parseDay = (day) => {
  const [year, month, date] = String(day).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
};

/** Shift a `YYYY-MM-DD` day string by a number of days. */
const addDays = (day, amount) => {
  const base = parseDay(day).getTime();
  const shifted = new Date(base + amount * DAY_MS);
  return shifted.toISOString().slice(0, 10);
};

/** Whole-day difference between two `YYYY-MM-DD` strings (b - a). */
const dayDiff = (a, b) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);

/** Whether `day` is exactly the day after `reference`. */
const isNextDay = (reference, day) => dayDiff(reference, day) === 1;

/** Whether both strings refer to the same calendar day. */
const isSameDay = (a, b) => a === b;

/** The UTC instant corresponding to local midnight of `day` in `timezone`. */
const startOfLocalDayUtc = (day, timezone = DEFAULT_TIMEZONE) => {
  const tz = resolveTimezone(timezone);
  const reference = parseDay(day);
  // Determine the timezone offset at that instant, then remove it.
  const asLocal = new Date(
    reference.toLocaleString('en-US', { timeZone: tz })
  );
  const asUtc = new Date(reference.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asUtc.getTime() - asLocal.getTime();
  return new Date(reference.getTime() + offsetMs);
};

/** Human readable label for a day string, e.g. "Fri, 04 Oct 2026". */
const formatDay = (day, timezone = DEFAULT_TIMEZONE) => {
  const tz = resolveTimezone(timezone);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parseDay(day));
};

/** The last `count` day strings ending at (and including) `endDay`. */
const lastNDays = (endDay, count) => {
  const days = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDays(endDay, -offset));
  }
  return days;
};

module.exports = {
  DAY_MS,
  resolveTimezone,
  localDay,
  todayIn,
  localTimeParts,
  parseDay,
  addDays,
  dayDiff,
  isNextDay,
  isSameDay,
  startOfLocalDayUtc,
  formatDay,
  lastNDays,
};
