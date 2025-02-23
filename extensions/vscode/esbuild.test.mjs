import * as esbuild from "esbuild";
import glob from "glob";

/**
 * Bundles tests into multiple files, runTestOnVSCodeHost is then run using node runTestOnVSCodeHost.js
 * It downloads vscode, starts it and passes test file to run - mochaRunner.js
 * mochaRunner.js then runs tests using Mocha class
 */

console.log("Bundling tests...");

// Bundles script to run tests on VSCode host + mocha runner that will be invoked from within VSCode host
await esbuild.build({
  entryPoints: [
    // Runs mocha runner on VSCode host using runTests from @vscode/test-electron
    "src/test/runner/runTestOnVSCodeHost.ts",

    // Runs the bundled tests using Mocha class
    "src/test/runner/mochaRunner.ts",
  ],
  bundle: true,
  outdir: "out",

  external: [
    "vscode",

    // Its important to externalize mocha, otherwise mocha seems to be not initialized properly when running tests
    // Example warning by esbuild when mocha is not externalized:
    // [WARNING] "./reporters/parallel-buffered" should be marked as external for use with "require.resolve" [require-resolve-not-external]
    "mocha",
  ],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },
});

/**
 * Note: Bundling is done to work around import issues, for example with fkill that does not provide cjs module.
 * Rather than figuring out a combination of tsconfig.json that would work, I decided to bundle tests instead.
 */
await esbuild.build({
  // Tests can be added anywhere in src folder
  entryPoints: glob.sync("src/**/*.test.ts"),
  bundle: true,
  outdir: "out",
  external: [
    "vscode",

    // Its important to externalize mocha, otherwise mocha seems to be not initialized properly when running tests
    "mocha",
  ],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },
  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
});
