/**
 * Shared Intl object instances with lazy initialization.
 *
 * Intl constructors are relatively expensive, so we cache instances
 * for reuse across the codebase.
 */

let graphemeSegmenter: Intl.Segmenter | null = null;
let wordSegmenter: Intl.Segmenter | null = null;

const relativeTimeFormatCache = new Map<string, Intl.RelativeTimeFormat>();
let cachedTimeZone: string | null = null;
let cachedSystemLocaleLanguage: string | undefined | null = null;

export function getGraphemeSegmenter(): Intl.Segmenter {
  if (!graphemeSegmenter) {
    graphemeSegmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
  }
  return graphemeSegmenter;
}

export function getWordSegmenter(): Intl.Segmenter {
  if (!wordSegmenter) {
    wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  }
  return wordSegmenter;
}

export function firstGrapheme(text: string): string {
  if (!text) return "";
  const first = getGraphemeSegmenter()
    .segment(text)
    [Symbol.iterator]()
    .next().value;
  return first?.segment ?? "";
}

export function lastGrapheme(text: string): string {
  if (!text) return "";
  let last = "";
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    last = segment;
  }
  return last;
}

export function getRelativeTimeFormat(
  style: "long" | "short" | "narrow",
  numeric: "always" | "auto",
): Intl.RelativeTimeFormat {
  const key = `${style}:${numeric}`;
  let formatter = relativeTimeFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat("en", { style, numeric });
    relativeTimeFormatCache.set(key, formatter);
  }
  return formatter;
}

export function getTimeZone(): string {
  if (!cachedTimeZone) {
    cachedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return cachedTimeZone;
}

export function getSystemLocaleLanguage(): string | undefined {
  if (cachedSystemLocaleLanguage === null) {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      cachedSystemLocaleLanguage = new Intl.Locale(locale).language;
    } catch {
      cachedSystemLocaleLanguage = undefined;
    }
  }
  return cachedSystemLocaleLanguage;
}
