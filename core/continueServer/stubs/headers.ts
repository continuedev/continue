import { constants, getTimestamp } from "../../deploy/constants";
import { Telemetry } from "../../util/posthog";

export async function getHeaders() {
  return {
    key: constants.c,
    timestamp: getTimestamp(),
    v: "1",
    extensionVersion: Telemetry.extensionVersion ?? "0.0.0",
    os: Telemetry.os ?? "Unknown",
    uniqueId: Telemetry.uniqueId ?? "None",
  };
}
