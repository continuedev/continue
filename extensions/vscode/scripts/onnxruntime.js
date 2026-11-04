// Helpers for packaging the onnxruntime-node native binaries.
//
// onnxruntime-node is not a direct dependency of core: it is pinned by
// @huggingface/transformers, so its version (and with it the napi version
// directory and the shared library file names) changes whenever transformers.js
// is upgraded. Nothing in here hardcodes those; the files are discovered in the
// installed package instead.
const fs = require("fs");
const path = require("path");

const coreDir = path.join(__dirname, "..", "..", "..", "core");

/** Finds `<dir>/node_modules/<name>` walking up from `fromDir`, like Node does. */
function findPackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find ${name} from ${fromDir}`);
    }
    dir = parent;
  }
}

/**
 * Directory of the onnxruntime-node that @huggingface/transformers will load
 * (it is normally hoisted to core/node_modules, but may be nested).
 */
function findOnnxRuntimeNodeDir() {
  const transformersDir = findPackageDir("@huggingface/transformers", coreDir);
  return findPackageDir("onnxruntime-node", transformersDir);
}

/** `napi-v3`, `napi-v6`, ... as shipped by the installed onnxruntime-node. */
function findNapiDirs(binDir) {
  return fs.readdirSync(binDir).filter((d) => /^napi-v\d+$/.test(d));
}

/** Matches the onnxruntime shared library for each OS (version-agnostic). */
const SHARED_LIBRARY_PATTERNS = {
  // libonnxruntime.so.1, libonnxruntime.so.1.21.0
  linux: /^libonnxruntime\.so\.\d[\d.]*$/,
  // libonnxruntime.1.21.0.dylib, libonnxruntime.1.dylib
  darwin: /^libonnxruntime\.\d[\d.]*\.dylib$/,
  // onnxruntime.dll
  win32: /^onnxruntime\.dll$/,
};

/**
 * Removes everything from the copied `bin` directory that the given target
 * does not need: other operating systems, other CPU architectures and the
 * (large, GPU only) CUDA/TensorRT provider libraries.
 */
function pruneOnnxRuntimeBin(binDir, os, arch) {
  for (const napi of findNapiDirs(binDir)) {
    const napiDir = path.join(binDir, napi);
    for (const osDir of fs.readdirSync(napiDir)) {
      if (osDir !== os) {
        fs.rmSync(path.join(napiDir, osDir), { recursive: true, force: true });
        continue;
      }
      for (const archDir of fs.readdirSync(path.join(napiDir, osDir))) {
        if (archDir !== arch) {
          fs.rmSync(path.join(napiDir, osDir, archDir), {
            recursive: true,
            force: true,
          });
        }
      }
    }
  }

  if (os === "linux") {
    for (const napi of findNapiDirs(binDir)) {
      const archDir = path.join(binDir, napi, os, arch);
      if (!fs.existsSync(archDir)) {
        continue;
      }
      const hasSoname = fs.existsSync(
        path.join(archDir, "libonnxruntime.so.1"),
      );
      for (const file of fs.readdirSync(archDir)) {
        if (
          /^libonnxruntime_providers_(cuda|shared|tensorrt)\.so/.test(file) ||
          // The binding links against libonnxruntime.so.1; the package ships a
          // second, identical copy named after the full version.
          (hasSoname && /^libonnxruntime\.so\.\d+\.\d+/.test(file))
        ) {
          fs.rmSync(path.join(archDir, file));
        }
      }
    }
  }
}

/**
 * Paths (relative to extensions/vscode) that must exist in the packaged
 * extension for onnxruntime-node to load on the given target. Discovered from
 * the copied `bin` directory, so a missing file is reported by
 * validateFilesPresent as a path that does not exist.
 */
function onnxRuntimeFilesToValidate(os, arch, binDir = "bin") {
  const napiDirs = fs.existsSync(binDir) ? findNapiDirs(binDir) : [];
  if (napiDirs.length === 0) {
    return [`${binDir}/napi-v*/${os}/${arch}/onnxruntime_binding.node`];
  }

  const files = [];
  for (const napi of napiDirs) {
    const archDir = `${binDir}/${napi}/${os}/${arch}`;
    files.push(`${archDir}/onnxruntime_binding.node`);
    const pattern = SHARED_LIBRARY_PATTERNS[os];
    const library = fs.existsSync(archDir)
      ? fs.readdirSync(archDir).find((f) => pattern?.test(f))
      : undefined;
    files.push(
      `${archDir}/${library ?? `<onnxruntime shared library for ${os}>`}`,
    );
  }
  return files;
}

module.exports = {
  findOnnxRuntimeNodeDir,
  pruneOnnxRuntimeBin,
  onnxRuntimeFilesToValidate,
};
