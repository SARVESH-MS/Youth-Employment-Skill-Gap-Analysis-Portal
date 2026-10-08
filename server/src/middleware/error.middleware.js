'use strict';

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { createLogger } = require('../utils/logger');
const logger = createLogger('errors');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found`));

const errorHandler = (error, _req, res, _next) => {
  let normalized = error;
  if (error instanceof mongoose.Error.ValidationError) {
    normalized = ApiError.unprocessable('Please review the submitted information', {
      details: Object.values(error.errors).map((item) => ({ field: item.path, message: item.message })),
    });
  } else if (error?.code === 11000) {
    normalized = ApiError.conflict('An account already uses one of these details', {
      details: { fields: Object.keys(error.keyPattern || {}) },
    });
  } else if (error?.name === 'CastError') {
    normalized = ApiError.badRequest('The requested identifier is invalid');
  } else if (error?.type === 'entity.too.large') {
    normalized = ApiError.badRequest('The request body is too large');
  }

  const status = normalized.statusCode || 500;
  if (status >= 500) logger.error(normalized.message, { stack: normalized.stack });
  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred' : normalized.message,
    ...(normalized.code ? { code: normalized.code } : {}),
    ...(normalized.details ? { details: normalized.details } : {}),
  });
};

module.exports = { notFound, errorHandler };
