'use strict';

/**
 * objectId — guards for Mongo ObjectIds. Every service that accepts an id from
 * a request validates it here first, so malformed input becomes a clean 400
 * instead of a Mongoose CastError.
 */

const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

/** Assert-and-return a valid ObjectId, or throw a 400. */
const requireId = (value, label = 'id') => {
  if (!isValidId(value)) {
    throw ApiError.badRequest(`Invalid ${label}`, { code: 'INVALID_OBJECT_ID' });
  }
  return new mongoose.Types.ObjectId(String(value));
};

/** Convert a list of ids, silently dropping anything invalid. */
const toObjectIds = (values = []) =>
  values.filter(isValidId).map((value) => new mongoose.Types.ObjectId(String(value)));

module.exports = { isValidId, requireId, toObjectIds };
