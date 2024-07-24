import { globalAgent } from "https";

export async function setupCa() {
  try {
    switch (process.platform) {
      case "darwin":
        // https://www.npmjs.com/package/mac-ca#usage
        const macCa = await import("mac-ca");
        macCa.addToGlobalAgent();
        break;
      case "win32":
        // https://www.npmjs.com/package/win-ca#caveats
        const { inject } = await import("win-ca");
        inject("+");
        break;
      default:
        // @ts-ignore
        const systemCertsAsync = await import("system-ca");
        // https://www.npmjs.com/package/system-ca

        // Error: This expression is not callable
        // globalAgent.options.ca = await systemCertsAsync();
        break;
    }
  } catch (e) {
    console.warn("Failed to setup CA: ", e);
  }
}
