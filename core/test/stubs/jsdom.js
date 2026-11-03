// Jest runs core as CommonJS-through-ts-jest, and jsdom >= 30 depends on ESM-only packages
// (parse5, @exodus/bytes) which `require` cannot load. Jest suites only import jsdom
// transitively (via the doc/URL context code) and none of them parse HTML with it; the
// ones that do (fetchFavicon) run under vitest instead. The real package is still bundled
// and used by the extension, CLI and binary.
export class JSDOM {
  constructor() {
    throw new Error("jsdom is stubbed in jest; use a *.vitest.ts test instead");
  }
}
