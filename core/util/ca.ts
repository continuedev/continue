import { globalAgent } from "https";
// @ts-ignore
import { systemCertsAsync } from "system-ca";

export async function setupCa() {
  try {
    switch (process.platform) {
      case "darwin":
        // https://www.npmjs.com/package/mac-ca#usage
        import macCa from "mac-ca";
        macCa.addToGlobalAgent();
        break;
      case "win32":
        // https://www.npmjs.com/package/win-ca#caveats
        import winCa from "win-ca";
        winCa.inject("+");
        break;
      default:
        // https://www.npmjs.com/package/system-ca
        globalAgent.options.ca = await systemCertsAsync();
        break;
    }
  } catch (e) {
    console.warn("Failed to setup CA: ", e);
  }
}
