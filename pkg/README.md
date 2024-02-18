# Continue Core Binary

The purpose of this folder is to package Typescript code in a way that can be run from any IDE or platform. We first bundle with `esbuild` and then package into binaries with `pkg`.

The `pkgJson/package.json` contains instructions for building with pkg, and needs to be in a separte folder because there is no CLI flag for the assets option (it must be in a package.json), and pkg doesn't recognize any name other than package.json, but if we use the same package.json with dependencies in it, pkg will automatically include these, significantly increasing the binary size.

The build process is otherwise defined entirely in `build.js`.
