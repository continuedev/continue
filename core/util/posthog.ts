export class Telemetry {
  // Set to undefined whenever telemetry is disabled
  static client: any = undefined;
  static uniqueId: string = "NOT_UNIQUE";

  static async capture(event: string, properties: any) {
    Telemetry.client?.capture({
      distinctId: Telemetry.uniqueId,
      event,
      properties,
    });
  }

  static shutdownPosthogClient() {
    Telemetry.client?.shutdown();
  }

  static async setup(allow: boolean, uniqueId: string) {
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
