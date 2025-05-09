const fs = require("fs");
const path = require("path");
const { rimrafSync } = require("rimraf");
const tar = require("tar");
const { RIPGREP_VERSION, TARGET_TO_RIPGREP_RELEASE } = require("./targets");
const AdmZip = require("adm-zip");

const RIPGREP_BASE_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}`;

// Mapping from our target triplets to ripgrep release file names is now imported from targets.js

/**
 * Downloads a file from a URL to a specified path
 *
 * @param {string} url - The URL to download from
 * @param {string} destPath - The destination path for the downloaded file
 * @returns {Promise<void>}
 */
async function downloadFile(url, destPath) {
  // Use the built-in fetch API instead of node-fetch
  const response = await fetch(url, {
    redirect: "follow", // Automatically follow redirects
  });

  if (!response.ok) {
    throw new Error(`Failed to download file, status code: ${response.status}`);
  }

  // Get the response as an array buffer and write it to the file
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Extracts an archive to a specified directory
 *
 * @param {string} archivePath - Path to the archive file
 * @param {string} targetDir - Directory to extract the archive to
 * @param {string} platform - Platform identifier (e.g., 'darwin', 'linux', 'win32')
 * @returns {Promise<void>}
 */
async function extractArchive(archivePath, targetDir, platform) {
  if (platform === "win32" || archivePath.endsWith(".zip")) {
    // Simple zip extraction for Windows - extract rg.exe
    const zip = new AdmZip(archivePath);

    const rgEntry = zip
      .getEntries()
      .find((entry) => entry.entryName.endsWith("rg.exe"));

    if (!rgEntry) {
      throw new Error("Could not find rg.exe in the downloaded archive");
    }

    // Extract the found rg.exe file to the target directory
    const entryData = rgEntry.getData();
    fs.writeFileSync(path.join(targetDir, "rg.exe"), entryData);
  } else {
    await tar.extract({
      file: archivePath,
      cwd: targetDir,
      strip: 1, // Strip the top-level directory
      filter: (path) => path.endsWith("/rg"),
    });
  }
}
/**
 * Downloads and installs ripgrep for the specified target
 *
 * @param {string} target - Target platform-arch (e.g., 'darwin-x64')
 * @param {string} targetDir - Directory to install ripgrep to
 * @returns {Promise<string>} - Path to the installed ripgrep binary
 */
async function downloadRipgrep(target, targetDir) {
  // Get the ripgrep release file name for the target
  const releaseFile = TARGET_TO_RIPGREP_RELEASE[target];
  if (!releaseFile) {
    throw new Error(`Unsupported target: ${target}`);
  }

  const platform = target.split("-")[0];
  const downloadUrl = `${RIPGREP_BASE_URL}/${releaseFile}`;
  const tempDir = path.join(targetDir, "temp");

  // Create temp directory
  fs.mkdirSync(tempDir, { recursive: true });

  const archivePath = path.join(tempDir, releaseFile);

  try {
    // Download the ripgrep release
    console.log(`[info] Downloading ripgrep from ${downloadUrl}`);
    await downloadFile(downloadUrl, archivePath);

    // Extract the archive
    console.log(`[info] Extracting ripgrep to ${targetDir}`);
    await extractArchive(archivePath, targetDir, platform);

    // Make the binary executable on Unix-like systems
    if (platform !== "win32") {
      const rgPath = path.join(targetDir, "rg");
      fs.chmodSync(rgPath, 0o755);
    }

    // Clean up
    rimrafSync(tempDir);

    // Return the path to the ripgrep binary
    const binName = platform === "win32" ? "rg.exe" : "rg";
    return path.join(targetDir, binName);
  } catch (error) {
    console.error(`[error] Failed to download ripgrep for ${target}:`, error);
    // Clean up temp directory on error
    rimrafSync(tempDir);
    throw error;
  }
}

module.exports = {
  downloadRipgrep,
  RIPGREP_VERSION,
};
