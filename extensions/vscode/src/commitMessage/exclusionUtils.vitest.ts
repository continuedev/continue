import { describe, expect, it } from "vitest";
import { shouldExclude } from "./exclusionUtils";

const lockfileNames = [
  "package-lock.json",
  "pnpm-workspace.yaml",
  ".yarnrc.yml",
  ".pnp.cjs",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "npm-shrinkwrap.json",
  "mix.lock",
  "project.assets.json",
  "paket.lock",
  "Cartfile.resolved",
  "composer.lock",
  "Podfile.lock",
  "Package.resolved",
  "pubspec.lock",
  ".terraform.lock.hcl",
  "flake.lock",
  "deno.lock",
  "devcontainer.lock.json",
  "conan.lock",
];

const nestedLockfilePaths = [
  "packages/api/npm-shrinkwrap.json",
  "subrepo/flutter/pubspec.lock",
  "services/backend/.terraform.lock.hcl",
  "tools/vendor/vendor.json",
  "project/.bundle/config",
];

const directoryPaths = [
  "frontend/.yarn/cache/core.lock",
  "libs/.yarn/unplugged/package.tgz",
  "apps/.yarn/build-state.yml",
  "apps/.yarn/install-state.gz",
  "shared/elm-stuff/exact-dependencies.json",
  "client/kotlin-js-store/build/index.js",
];

describe("shouldExclude", () => {
  it.each(lockfileNames)("returns true for %s", (filename) => {
    expect(shouldExclude(filename)).toBe(true);
  });

  it.each(nestedLockfilePaths)(
    "returns true for nested lockfile path %s",
    (nestedPath) => {
      expect(shouldExclude(nestedPath)).toBe(true);
    },
  );

  it.each(directoryPaths)(
    "returns true for excluded directory path %s",
    (dirPath) => {
      expect(shouldExclude(dirPath)).toBe(true);
    },
  );

  it("returns true for values flagged as security concerns", () => {
    expect(shouldExclude("secrets/.ssh/id_rsa")).toBe(true);
  });

  it("returns false for safe, non-lockfile paths", () => {
    expect(shouldExclude("src/index.ts")).toBe(false);
  });
});
