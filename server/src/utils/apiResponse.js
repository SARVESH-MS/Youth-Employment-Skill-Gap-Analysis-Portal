'use strict';

/**
 * apiResponse — the single response envelope every endpoint returns, so the
 * frontend can rely on one shape: { success, message, data, meta }.
 */

const ok = (res, data = null, message = 'OK', meta = undefined, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data, ...(meta ? { meta } : {}) });

const created = (res, data = null, message = 'Created', meta = undefined) =>
  ok(res, data, message, meta, 201);

const noContent = (res) => res.status(204).send();

const fail = (res, statusCode, message, details = undefined) =>
  res.status(statusCode).json({ success: false, message, ...(details ? { details } : {}) });

/** Attach pagination metadata consistently for list endpoints. */
const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = { ok, created, noContent, fail, buildPaginationMeta };
