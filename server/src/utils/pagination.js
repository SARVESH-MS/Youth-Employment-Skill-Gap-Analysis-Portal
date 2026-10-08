'use strict';

/**
 * pagination — normalises page/limit query params into safe values and builds
 * the Mongo skip/limit pair plus sort order. Every list endpoint uses this so
 * paging behaves identically platform-wide.
 */

const { PAGINATION } = require('../config/constants');

const parsePagination = (query = {}) => {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : PAGINATION.DEFAULT_PAGE;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, PAGINATION.MAX_LIMIT)
    : PAGINATION.DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Parse a sort expression such as `-createdAt` or `name`.
 * Returns a Mongo sort object; defaults to newest-first.
 */
const parseSort = (sort, fallback = { createdAt: -1 }) => {
  if (!sort || typeof sort !== 'string') return fallback;
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  if (!/^[a-zA-Z0-9_.]+$/.test(field)) return fallback;
  return { [field]: sort.startsWith('-') ? -1 : 1 };
};

module.exports = { parsePagination, parseSort };
