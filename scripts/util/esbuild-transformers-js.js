// esbuild plugin for bundling @huggingface/transformers (transformers.js) with
// onnxruntime-node, which core uses to compute embeddings locally.
//
// 1. `sharp` is replaced with an empty module. transformers.js imports it
//    unconditionally to decode images, but we only ever embed text. sharp is a
//    native module (libvips) that is not shipped with the extension, binary or
//    CLI, and its loader throws at load time when the platform binary is
//    missing, which would take the whole transformers.js import down with it.
//    With the stub, transformers.js loads normally and only the image APIs
//    (which we do not use) are unavailable.
//
// 2. onnxruntime-node's native binding is left as a runtime require. Its
//    dist/binding.js does
//      require(`../bin/napi-v3/${process.platform}/${process.arch}/onnxruntime_binding.node`)
//    and esbuild expands such a template into a glob over every platform. With
//    the ".node": "file" loader that makes `binding` a *path string* instead of
//    the loaded addon, and onnxruntime-node then fails with
//    "listSupportedBackends is not a function". Hiding the template from
//    esbuild keeps it a real runtime require, resolved relative to the bundle
//    (<extension>/out/extension.js -> <extension>/bin/napi-vN/<os>/<arch>/),
//    which is where the packaging scripts put the native files.
const fs = require("fs");

const NATIVE_BINDING_REQUIRE =
  /require\((`\.\.\/bin\/napi-v\d+\/\$\{process\.platform\}\/\$\{process\.arch\}\/onnxruntime_binding\.node`)\)/;

const transformersJsPlugin = {
  name: "transformers-js",
  setup(build) {
    build.onResolve({ filter: /^sharp$/ }, (args) => ({
      path: args.path,
      namespace: "stub-sharp",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub-sharp" }, () => ({
      contents: "module.exports = { __esModule: true, default: undefined };",
      loader: "js",
    }));

    build.onLoad(
      { filter: /onnxruntime-node[\\/]dist[\\/]binding\.js$/ },
      async (args) => {
        const source = await fs.promises.readFile(args.path, "utf8");
        if (!NATIVE_BINDING_REQUIRE.test(source)) {
          throw new Error(
            `transformers-js: could not find the native binding require in ${args.path}; update scripts/util/esbuild-transformers-js.js for this onnxruntime-node version`,
          );
        }
        return {
          // The identity call makes the argument opaque to esbuild's glob handling
          contents: source.replace(
            NATIVE_BINDING_REQUIRE,
            (_, template) => `require(((p) => p)(${template}))`,
          ),
          loader: "js",
        };
      },
    );
  },
};

module.exports = { transformersJsPlugin };
