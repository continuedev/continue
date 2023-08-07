import * as path from "path";
import Mocha from "mocha";
import * as glob from "glob";

export function run() {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  // See esbuild.test.mjs for more details
  // Assumes this file is in out/test-runner/mochaRunner.js
  const compiledTestSuitesDirectory = path.resolve(__dirname, "../test-suites");

  glob.sync("**/**.test.js", { cwd: compiledTestSuitesDirectory }).forEach((file) => {
    mocha.addFile(path.resolve(compiledTestSuitesDirectory, file));
  });

  return new Promise<void>((c, e) => {
    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error(err);
      e(err);
    }
  });
}
