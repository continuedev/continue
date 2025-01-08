import { getRedHatService, TelemetryService } from "@redhat-developer/vscode-redhat-telemetry";
import { ExtensionContext } from "vscode";

export namespace Telemetry {
  let telemetryService: TelemetryService;

  export async function initialize(context: ExtensionContext): Promise<void> {
    const redhatService = await getRedHatService(context);
    telemetryService = await redhatService.getTelemetryService();
    if (!telemetryService) {
      console.error("Failed to initialize Red Hat telemetry service");
      return;
    }
    return telemetryService.sendStartupEvent();
  }

  export async function send(eventName: string, properties?: { [key: string]: any }): Promise<void> {
    const props = properties ? `with properties: ${JSON.stringify(properties)}` : '';
    console.log(`Sending event: ${eventName} ${props}`);
    return await telemetryService?.send({ name: eventName, properties });
  }

}
