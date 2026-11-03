/**
 * Kept free of Node imports so the webview can use it too.
 *
 * Default secret name for a provider's key, e.g. CONTINUED_ANTHROPIC_API_KEY.
 */
export function defaultSecretName(provider: string): string {
  const slug = provider
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `CONTINUED_${slug || "PROVIDER"}_API_KEY`;
}
