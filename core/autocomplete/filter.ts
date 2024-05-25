export function isOnlyPunctuationAndWhitespace(completion: string): boolean {
  const punctuationAndWhitespaceRegex = /^[^\w\d\}\)\]]+$/;
  return punctuationAndWhitespaceRegex.test(completion);
}
