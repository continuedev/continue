const RIPGREP_VERSION = "14.1.1";

/**
 * All supported platform-architecture targets
 */
const ALL_TARGETS = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
];

/**
 * Mapping from target triplets to ripgrep release file names
 */
const TARGET_TO_RIPGREP_RELEASE = {
  "darwin-x64": `ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`,
  "darwin-arm64": `ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz`,
  "linux-x64": `ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`,
  "linux-arm64": `ripgrep-${RIPGREP_VERSION}-aarch64-unknown-linux-gnu.tar.gz`,
  "win32-x64": `ripgrep-${RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip`,
};

/**
 * Mapping from target triplets to LanceDB package names
 */
const TARGET_TO_LANCEDB = {
  "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
  "darwin-x64": "@lancedb/vectordb-darwin-x64",
  "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
  "linux-x64": "@lancedb/vectordb-linux-x64-gnu",
  "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
  "win32-arm64": "@lancedb/vectordb-win32-arm64-msvc",
};

module.exports = {
  ALL_TARGETS,
  TARGET_TO_RIPGREP_RELEASE,
  TARGET_TO_LANCEDB,
  RIPGREP_VERSION,
};
