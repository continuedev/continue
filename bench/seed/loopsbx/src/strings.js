/**
 * Slugify a value into a lowercase, hyphen-separated slug.
 *
 * Any run of characters that is not a Unicode letter or digit (whitespace,
 * punctuation, underscores, emoji, ...) collapses into a single hyphen, and
 * hyphens are trimmed from both edges. Non-string input is coerced with
 * String(...) so it never throws.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-') // runs of anything not a letter/digit -> one hyphen
    .replace(/^-+|-+$/g, ''); // no leading / trailing hyphens
}

/**
 * Truncate a value to at most `max` characters, counting the ellipsis in `max`.
 *
 * The returned string is never longer than `max` UTF-16 code units: when the
 * text does not fit, it is cut to `max - 1` characters and a single `…` is
 * appended, so `truncate('hello', 3)` is `'he…'` (3 chars). A text that already
 * fits is returned unchanged, with no ellipsis. `max` is floored to an integer;
 * a negative or non-numeric `max` yields `''`, as does `max === 0` (there is no
 * room for the ellipsis). Non-string input is coerced with String(...) so it
 * never throws.
 *
 * Length is measured in UTF-16 code units (`.length`), not grapheme clusters.
 *
 * @param {unknown} text
 * @param {number|string|null|undefined} max
 * @returns {string}
 */
export function truncate(text, max) {
  const s = String(text);
  const n = Math.floor(Number(max));
  if (!(n >= 0) || n === 0) return ''; // negative / NaN max, or no room for the ellipsis
  if (s.length <= n) return s; // already fits
  return s.slice(0, Math.max(0, n - 1)) + '…'; // result is exactly n chars
}
