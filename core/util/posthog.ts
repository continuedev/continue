import os from "os";

export class Telemetry {
  // Set to undefined whenever telemetry is disabled
  static client: any = undefined;
  static uniqueId: string = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static extensionVersion: string | undefined = undefined;

  static async capture(event: string, properties: { [key: string]: any }) {
    Telemetry.client?.capture({
      distinctId: Telemetry.uniqueId,
      event,
      properties: {
        ...properties,
        os: Telemetry.os,
        extensionVersion: Telemetry.extensionVersion,
      },
    });
  }

  static shutdownPosthogClient() {
    Telemetry.client?.shutdown();
  }

  static async setup(
    allow: boolean,
    uniqueId: string,
    extensionVersion: string,
  ) {
    Telemetry.uniqueId = uniqueId;
    Telemetry.os = os.platform();
    Telemetry.extensionVersion = extensionVersion;

    if (!allow) {
      Telemetry.client = undefined;
    } else {
      try {
        if (!Telemetry.client) {
          const { PostHog } = await import("posthog-node");
          Telemetry.client = new PostHog(
            "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs",
            {
              host: "https://app.posthog.com",
            },
          );
        }
      } catch (e) {
        console.error(`Failed to setup telemetry: ${e}`);
      }
    }
  }
}
