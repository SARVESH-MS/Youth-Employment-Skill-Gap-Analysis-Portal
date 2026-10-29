function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Match every search word, in any order, across the supplied searchable fields. */
export function matchesSearch(query, ...values) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const haystack = normalizeSearchText(values.flat(Infinity).filter((value) => value != null).join(' '));
  return terms.every((term) => haystack.includes(term));
}
