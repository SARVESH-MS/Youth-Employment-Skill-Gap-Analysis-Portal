'use strict';

/**
 * random — deterministic-safe randomness helpers used by assessments, seed
 * data and admin provisioning. Never used for security-sensitive tokens
 * (those come from node:crypto in utils/token.js).
 */

const { randomInt: cryptoRandomInt, randomBytes } = require('node:crypto');

const randomInt = (min, max) => cryptoRandomInt(min, max + 1);

const randomPick = (items = []) => {
  if (!items.length) return undefined;
  return items[randomInt(0, items.length - 1)];
};

/** Fisher–Yates shuffle — returns a new array, never mutates the input. */
const shuffle = (items = []) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** Take `count` distinct items at random (order shuffled). */
const sample = (items = [], count = 1) => shuffle(items).slice(0, Math.max(0, count));

/** Weighted pick: `entries` are `{ value, weight }` objects. */
const weightedPick = (entries = []) => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight ?? 1), 0);
  if (total <= 0) return entries[0]?.value;
  let threshold = Math.random() * total;
  for (const entry of entries) {
    threshold -= Math.max(0, entry.weight ?? 1);
    if (threshold <= 0) return entry.value;
  }
  return entries[entries.length - 1]?.value;
};

/** A readable, reasonably strong temporary password for admin provisioning. */
const generateTempPassword = (length = 12) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const required = [
    upper[randomInt(0, upper.length - 1)],
    lower[randomInt(0, lower.length - 1)],
    digits[randomInt(0, digits.length - 1)],
    symbols[randomInt(0, symbols.length - 1)],
  ];
  const rest = Array.from({ length: Math.max(4, length - required.length) }, () =>
    all[randomInt(0, all.length - 1)]
  );
  return shuffle([...required, ...rest]).join('');
};

/** Deterministic-ish username base from a name, e.g. "Aarav Sharma" → aarav.sharma */
const usernameBase = (fullName = 'user') =>
  String(fullName)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .slice(0, 40) || 'user';

/** Short unique suffix used to disambiguate usernames/emails in bulk seeds. */
const shortId = (bytes = 3) => randomBytes(bytes).toString('hex');

module.exports = {
  randomInt,
  randomPick,
  shuffle,
  sample,
  weightedPick,
  generateTempPassword,
  usernameBase,
  shortId,
};
