import path from "node:path";
import ignore from "ignore";
import { isSecurityConcern } from "../../../../core/indexing/ignore";

const LOCKFILE_DIFF_HEADER = /^diff --git a\/[^\s]+ b\/(?<target>[^\s]+)/m;

const LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "bun.lockb",
  ".yarnrc.yml",
  ".pnp.js",
  ".pnp.cjs",
  "jspm.lock",
  "Pipfile.lock",
  "poetry.lock",
  "pdm.lock",
  ".pdm-lock.toml",
  "conda-lock.yml",
  "pylock.toml",
  "Gemfile.lock",
  ".bundle/config",
  "composer.lock",
  "gradle.lockfile",
  "lockfile.json",
  "dependency-lock.json",
  "dependency-reduced-pom.xml",
  "coursier.lock",
  "build.sbt.lock",
  "packages.lock.json",
  "paket.lock",
  "project.assets.json",
  "Cargo.lock",
  "go.sum",
  "Gopkg.lock",
  "glide.lock",
  "vendor/vendor.json",
  "build.zig.zon.lock",
  "dune.lock",
  "opam.lock",
  "Package.resolved",
  "Podfile.lock",
  "Cartfile.resolved",
  "pubspec.lock",
  "mix.lock",
  "rebar.lock",
  "stack.yaml.lock",
  "cabal.project.freeze",
  "elm-stuff/exact-dependencies.json",
  "shard.lock",
  "Manifest.toml",
  "JuliaManifest.toml",
  "renv.lock",
  "packrat.lock",
  "nimble.lock",
  "dub.selections.json",
  "rocks.lock",
  "carton.lock",
  "cpanfile.snapshot",
  "conan.lock",
  "vcpkg-lock.json",
  ".terraform.lock.hcl",
  "Berksfile.lock",
  "Puppetfile.lock",
  "flake.lock",
  "deno.lock",
  "devcontainer.lock.json",
];

const DIRECTORY_PATTERNS = [
  "**/.yarn/cache",
  "**/.yarn/cache/**",
  "**/.yarn/unplugged",
  "**/.yarn/unplugged/**",
  "**/.yarn/build-state.yml",
  "**/.yarn/install-state.gz",
  "**/elm-stuff",
  "**/elm-stuff/**",
  "**/kotlin-js-store",
  "**/kotlin-js-store/**",
];

const lockFileIgnoreInstance = ignore().add([
  ...LOCKFILES.map((file) => `**/${file}`),
  ...DIRECTORY_PATTERNS,
]);

function getNormalizedTargetPath(diffOrPath: string): string {
  if (!diffOrPath) {
    return "";
  }
  const trimmedInput = diffOrPath.trim();
  const headerMatch = LOCKFILE_DIFF_HEADER.exec(trimmedInput);
  const targetPath = headerMatch?.groups?.target ?? trimmedInput;
  const normalized = path.normalize(targetPath);
  return normalized.replace(/\\/g, "/");
}

export function shouldExclude(diffOrPath: string): boolean {
  const normalizedPath = getNormalizedTargetPath(diffOrPath);
  if (!normalizedPath) {
    return false;
  }
  if (isSecurityConcern(normalizedPath)) {
    return true;
  }
  return lockFileIgnoreInstance.ignores(normalizedPath);
}
