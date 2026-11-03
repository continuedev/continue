// esbuild plugin for bundling jsdom >= 25.
//
// jsdom's computed-style helper reads its default stylesheet from disk at
// load time, relative to __dirname:
//
//   fs.readFileSync(path.resolve(__dirname, "../../../browser/default-stylesheet.css"), ...)
//
// A bundle has neither that directory layout nor (for ESM output) __dirname,
// so the bundled module throws on load. This plugin inlines the stylesheet
// into the module source instead. For jsdom versions that do not ship the
// .css file (<= 24) it does nothing.
const fs = require("fs");
const path = require("path");

const READ_DEFAULT_STYLESHEET =
  /fs\.readFileSync\(\s*path\.resolve\(__dirname,\s*"\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css"\)\s*,\s*\{[^}]*\}\s*\)/;

const jsdomDefaultStylesheetPlugin = {
  name: "jsdom-default-stylesheet",
  setup(build) {
    build.onLoad(
      {
        filter:
          /jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]css[\\/]helpers[\\/]computed-style\.js$/,
      },
      async (args) => {
        const cssPath = path.resolve(
          path.dirname(args.path),
          "../../../browser/default-stylesheet.css",
        );
        if (!fs.existsSync(cssPath)) {
          return undefined;
        }
        const source = await fs.promises.readFile(args.path, "utf8");
        if (!READ_DEFAULT_STYLESHEET.test(source)) {
          throw new Error(
            `jsdom-default-stylesheet: could not find the default stylesheet read in ${args.path}; update scripts/util/esbuild-jsdom-stylesheet.js for this jsdom version`,
          );
        }
        const css = await fs.promises.readFile(cssPath, "utf8");
        return {
          contents: source.replace(READ_DEFAULT_STYLESHEET, () =>
            JSON.stringify(css),
          ),
          loader: "js",
          resolveDir: path.dirname(args.path),
        };
      },
    );
  },
};

module.exports = { jsdomDefaultStylesheetPlugin };
