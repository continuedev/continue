#!/usr/bin/env node
// Pack the built CLI as a release asset: continuous-cli-<version>.tgz.
//
//   node scripts/pack-release.mjs <version> [outDir]
//
// Run `npm run build` first. dist/index.js is a self-contained esbuild bundle
// (core and the local packages included), so the packed package.json lists no
// dependencies: `npm i -g <asset URL>` installs it on Node 22+ without fetching
// anything else. Only the files the CLI runs are packed.
import { execSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const cliDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [version, outArg] = process.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: node scripts/pack-release.mjs <version> [outDir]");
  process.exit(1);
}
const outDir = resolve(outArg ?? cliDir);

const FILES = [
  "dist/index.js",
  "dist/cn.js",
  "dist/xhr-sync-worker.js",
  "README.md",
];
for (const file of FILES) {
  if (!existsSync(join(cliDir, file))) {
    console.error(`missing ${file}: run npm run build first`);
    process.exit(1);
  }
}

const source = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf8"));
const manifest = {
  name: source.name,
  version,
  description: source.description,
  type: source.type,
  main: "dist/index.js",
  bin: source.bin,
  files: FILES,
  engines: source.engines,
  license: source.license,
  repository: source.repository,
  bugs: source.bugs,
  homepage: source.homepage,
};

const stage = mkdtempSync(join(tmpdir(), "continuous-cli-pack-"));
try {
  for (const file of FILES) {
    mkdirSync(dirname(join(stage, file)), { recursive: true });
    copyFileSync(join(cliDir, file), join(stage, file));
  }
  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const licence = resolve(cliDir, "../../LICENSE");
  if (existsSync(licence)) copyFileSync(licence, join(stage, "LICENSE"));

  mkdirSync(outDir, { recursive: true });
  const out = execSync(
    `npm pack --json --ignore-scripts --pack-destination "${outDir}"`,
    { cwd: stage, encoding: "utf8" },
  );
  const packed = join(outDir, JSON.parse(out)[0].filename);
  const target = join(outDir, `continuous-cli-${version}.tgz`);
  rmSync(target, { force: true });
  renameSync(packed, target);
  console.log(target);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
