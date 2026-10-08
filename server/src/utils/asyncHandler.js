'use strict';

/**
 * asyncHandler — wraps an async route handler so a rejected promise is
 * forwarded to Express's error pipeline instead of crashing the process or
 * hanging the request. Every async controller is wrapped with this.
 */

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = asyncHandler;
