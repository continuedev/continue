import { globalAgent } from "https";

// @ts-ignore
import { systemCertsAsync } from "system-ca";

export async function setupCa() {
  try {
    switch (process.platform) {
      case "darwin":
        // Documentation unavailable in air-gapped mode
        const macCa = await import("mac-ca");
        macCa.addToGlobalAgent();
        break;
      case "win32":
        // Documentation unavailable in air-gapped mode
        const winCa = await import("win-ca");
        winCa.inject("+");
        break;
      default:
        // Documentation unavailable in air-gapped mode
        globalAgent.options.ca = await systemCertsAsync();
        break;
    }
  } catch (e) {
    console.warn("Failed to setup CA: ", e);
  }
}
