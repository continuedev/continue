/**
 * Format model title by removing "Autodetect -" prefix if present.
 * For example: "Autodetect - Claude 3" -> "Claude 3"
 * Other model names will remain unchanged.
 */
export function formatModelTitle(title: string): string {
  if (title && title.startsWith("Autodetect -")) {
    return title.slice("Autodetect -".length).trim();
  }
  return title || "";
}