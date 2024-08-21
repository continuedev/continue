import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  getChromiumExecutablePath,
  getContinueUtilsChromiumPath,
} from "../../util/paths";
import extract from "extract-zip";
import { Writable } from "stream";

const PACKAGE_ZIP_FILENAME = "package.zip";

/**
 * These Chromium versions are what is installed by default from
 * "playwright": "^1.46.1"
 *
 * Note that if we bump our version of playwright, we will need to install new
 * Chromium versions as well.
 *
 * See Playwright source code for download paths: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts
 */
const DOWNLOAD_URLS: { [key: string]: string } = {
  linux:
    "https://playwright.azureedge.net/builds/chromium/1129/chromium-linux.zip",
  darwin:
    "https://playwright.azureedge.net/builds/chromium/1129/chromium-mac.zip",
  win32:
    "https://playwright.azureedge.net/builds/chromium/1129/chromium-win64.zip",
};

async function downloadPackage(): Promise<string> {
  console.log("Downloading Chromium zip");

  const platform = os.platform();
  const downloadUrl = DOWNLOAD_URLS[platform];

  if (!downloadUrl) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const zipPath = path.join(
    getContinueUtilsChromiumPath(),
    PACKAGE_ZIP_FILENAME,
  );
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Chromium. Status code: ${response.status}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  // @ts-ignore
  const fileStream = Writable.toWeb(fs.createWriteStream(zipPath));

  await response.body.pipeTo(fileStream);

  return zipPath;
}

async function extractZip(zipPath: string): Promise<void> {
  try {
    console.debug(
      `Extracting Chromium zip to ${getContinueUtilsChromiumPath()}`,
    );
    await extract(zipPath, { dir: getContinueUtilsChromiumPath() });
    await fs.promises.unlink(zipPath);
  } catch (err) {
    console.debug(`Error unzipping Chromium: ${err}`);
  }
}

export function isChromiumInstalled(): boolean {
  const chromiumBinaryPath = getChromiumExecutablePath(os.platform());
  return !!chromiumBinaryPath && fs.existsSync(chromiumBinaryPath);
}

export async function installChromium() {
  try {
    console.debug("Installing Chromium");
    const zipPath = await downloadPackage();
    await extractZip(zipPath);
    console.debug("Successfully installed Chromium");
  } catch (error) {
    console.debug("Chromium installation failed:", error);
    process.exit(1);
  }
}
