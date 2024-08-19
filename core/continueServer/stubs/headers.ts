import { constants, getTimestamp } from "../../deploy/constants.js";
import { Telemetry } from "../../util/posthog.js";

export async function getHeaders() {
  return {
    key: constants.c,
    timestamp: getTimestamp(),
    v: "1",
    extensionVersion: Telemetry.ideInfo?.extensionVersion ?? "0.0.0",
    os: Telemetry.os ?? "Unknown",
    uniqueId: Telemetry.uniqueId ?? "None",
  };
}
