const LAZY_COMMENT_REGEX = /\.{3}\s*(.+?)\s*\.{3}/;

export function isLazyText(text: string): boolean {
  return LAZY_COMMENT_REGEX.test(text);
}
