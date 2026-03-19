import { constants, getTimestamp } from "../../deploy/constants.js";
import { IdeInfoService } from "../../util/IdeInfoService.js";

export async function getHeaders() {
  return {
    key: constants.c,
    timestamp: getTimestamp(),
    v: "1",
    extensionVersion: IdeInfoService.ideInfo?.extensionVersion ?? "0.0.0",
    os: IdeInfoService.os ?? "Unknown",
    uniqueId: IdeInfoService.uniqueId ?? "None",
  };
}
