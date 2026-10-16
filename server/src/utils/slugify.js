/**
 * Normalise arbitrary text into a URL-safe slug body:
 * strips diacritics (é → e), lowercases, hyphenates whitespace and drops any
 * remaining non [a-z0-9-] characters.
 *
 * Non-Latin scripts are removed entirely — if you need them, plug a
 * transliteration step into `toAscii` below.
 */
const toAscii = (text) =>
  String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, ''); // combining diacritical marks

const normalizeSlug = (input) =>
  toAscii(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Generate a unique-ish slug: `<normalised-name>-<suffix>`.
 * @param {string} name
 * @param {string|number} [suffix] - defaults to Date.now()
 */
const generateSlug = (name, suffix = null) => {
  const base = normalizeSlug(name);
  const end = suffix ?? Date.now();
  return base ? `${base}-${end}` : String(end);
};

module.exports = { generateSlug, normalizeSlug };
