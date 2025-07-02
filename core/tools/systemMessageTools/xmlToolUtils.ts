export function closeTag(openingTag: string): string {
  return `</${openingTag.slice(1)}`;
}
