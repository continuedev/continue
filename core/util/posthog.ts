import { IdeInfo } from "../index.js";

export class Telemetry {
  static uniqueId = "NOT_UNIQUE";
  static ideInfo: IdeInfo | undefined = undefined;

  static async captureError(_errorName: string, _error: unknown) {}

  static async capture(
    _event: string,
    _properties: { [key: string]: any },
    _sendToTeam: boolean = false,
    _isExtensionActivationError: boolean = false,
  ) {}

  static shutdownPosthogClient() {}

  static async setup(
    _allow: boolean,
    uniqueId: string,
    ideInfo: IdeInfo,
  ) {
    Telemetry.uniqueId = uniqueId;
    Telemetry.ideInfo = ideInfo;
  }
}
