// Jest runs core as CommonJS-through-ts-jest, and puppeteer-chromium-resolver >= 25 loads an
// ESM-only puppeteer-core, which `require` cannot load. The only tests that call it (the
// Chromium crawler cases in DocsCrawler.test.ts) are skipped, so a stub is enough here.
// The real package is still bundled and used by the extension.
export default async function PCR() {
  throw new Error("puppeteer-chromium-resolver is stubbed in jest");
}
