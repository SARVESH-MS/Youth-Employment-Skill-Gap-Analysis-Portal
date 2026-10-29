'use strict';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a bounded, case-insensitive, partial-word search across fields. */
function tokenSearchFilter(query, fields, maxLength = 100) {
  const terms = String(query || '').slice(0, maxLength).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return {};

  return {
    $and: terms.map((term) => ({
      $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(term), $options: 'i' } })),
    })),
  };
}

module.exports = { tokenSearchFilter };
