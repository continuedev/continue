export function canParseUrl(url: string): boolean {
  if ((URL as any)?.canParse) {
    return (URL as any).canParse(url);
  }
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}
