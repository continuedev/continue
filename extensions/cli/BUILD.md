# Build Process Documentation

## Overview

The Continue CLI uses esbuild to bundle the application along with local packages (`@continuedev/config-yaml` and `@continuedev/openai-adapters`) into a single distributable file. This ensures that users who install the CLI from npm don't need to worry about local file references.

## Build Steps

1. **Build packages**: `cd ../../ && node ./scripts/build-packages.js`
2. **Install dependencies**: `npm install`
3. **Build**: `npm run build`
   - This first builds the local packages
   - Then bundles everything with esbuild

## How it Works

### Bundling Strategy

The `build.mjs` script uses esbuild to:

- Bundle all TypeScript/JavaScript code into a single ES module
- Include local packages (`@continuedev/config-yaml`, `@continuedev/openai-adapters`) directly in the bundle
- Keep problematic or native dependencies external (e.g., `@sentry/profiling-node`, `winston`, `express`)
- Create a wrapper script (`dist/cn.js`) with the proper shebang for CLI execution

### Key Features

- **Local Package Bundling**: Local packages are bundled directly, avoiding `file:` reference issues
- **Stub for Optional Dependencies**: `react-devtools-core` is stubbed to prevent runtime errors
- **CommonJS Compatibility**: Adds `createRequire` to support packages that use dynamic requires
- **Source Maps**: Generates source maps for debugging
- **Metadata**: Creates `dist/meta.json` with bundle analysis information

## Testing

### Smoke Tests

Run smoke tests to verify the build:

```bash
npm run test:smoke
```

The smoke tests verify:

- Bundle files exist
- CLI commands work (--version, --help)
- Bundle size is reasonable (<20MB)
- Local packages are properly bundled
- No missing runtime dependencies

## Troubleshooting

### Common Issues

1. **Module not found errors**: Check if the module needs to be added to the external list in `build.mjs`
2. **Native module issues**: Native modules should be marked as external
3. **Bundle too large**: Review bundled packages in `dist/meta.json` and consider marking large packages as external

### Analyzing the Bundle

After building, check `dist/meta.json` to see:

- What packages were bundled
- Bundle size breakdown
- Input/output file mappings

## Publishing

When publishing to npm:

1. The bundled files in `dist/` are included
2. Users install via `npm install -g @continuedev/cli`
3. The `cn` command becomes available globally
4. No local file references or missing dependencies
