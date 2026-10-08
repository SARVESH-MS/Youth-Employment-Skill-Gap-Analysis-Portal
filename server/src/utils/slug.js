'use strict';

/**
 * slug — turns a human title into a URL-safe, lowercase, dash-separated slug.
 * Used for domains, skills, modules and coding problems. Uniqueness is the
 * caller's concern (they pass a suffix/seed where required).
 */

const slugify = (value = '') =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);

/** Slug with a short random suffix, for cases where uniqueness is required. */
const uniqueSlug = (value, suffix = Math.random().toString(36).slice(2, 7)) =>
  `${slugify(value) || 'item'}-${suffix}`;

module.exports = { slugify, uniqueSlug };
