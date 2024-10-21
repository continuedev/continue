export function isOnlyWhitespace(completion: string): boolean {
  const whitespaceRegex = /^[\s]+$/;
  return whitespaceRegex.test(completion);
}
