import { constants, getTimestamp } from "../../deploy/constants.js";
<<<<<<< HEAD
import { Telemetry } from "../../util/posthog.js";
=======
import { IdeInfoService } from "../../util/IdeInfoService.js";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

export async function getHeaders() {
  return {
    key: constants.c,
    timestamp: getTimestamp(),
    v: "1",
<<<<<<< HEAD
    extensionVersion: Telemetry.ideInfo?.extensionVersion ?? "0.0.0",
    os: Telemetry.os ?? "Unknown",
    uniqueId: Telemetry.uniqueId ?? "None",
=======
    extensionVersion: IdeInfoService.ideInfo?.extensionVersion ?? "0.0.0",
    os: IdeInfoService.os ?? "Unknown",
    uniqueId: IdeInfoService.uniqueId ?? "None",
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  };
}
