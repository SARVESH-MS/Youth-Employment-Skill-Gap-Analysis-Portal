'use strict';

const crypto = require('node:crypto');
const { env } = require('../config/env');
const { randomToken, safeCompare } = require('./token');

const createCsrfToken = () => {
  const nonce = randomToken(32);
  const signature = crypto.createHmac('sha256', env.security.csrfSecret).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
};

const verifyCsrfToken = (token) => {
  if (typeof token !== 'string') return false;
  const separator = token.lastIndexOf('.');
  if (separator < 1 || separator === token.length - 1) return false;
  const nonce = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto.createHmac('sha256', env.security.csrfSecret).update(nonce).digest('hex');
  return safeCompare(signature, expected);
};

module.exports = { createCsrfToken, verifyCsrfToken };
