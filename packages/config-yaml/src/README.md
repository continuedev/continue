# config.yaml specification

This specification is a work in progress and subject to change.

## Loading a config.yaml file

config.yaml is loaded in the following steps

## Unrolling

A "source" config.yaml is "unrolled" so that its packages all get merged into a single config.yaml. This is done by recursively loading all packages and merging them into the config.yaml.

This happens on the server, unless using local mode.

## Client rendering

The unrolled config.yaml is then rendered on the client. This is done by replacing all user secret template variables with their values and replacing all other secrets with secret locations.

## Publishing

First, bump the version in `package.json` and then run:

```bash
npm run build
npm publish --access public
```

Make sure you have an `NPM_TOKEN` set in your `packages/config-yaml/.env` file.
