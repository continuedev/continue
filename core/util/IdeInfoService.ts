import { IdeInfo } from "../index.js";

export class IdeInfoService {
  static uniqueId = "NOT_UNIQUE";
  static os: string | undefined = undefined;
  static ideInfo: IdeInfo | undefined = undefined;

  static setup(
    uniqueId: string,
    ideInfo: IdeInfo,
  ): void {
    IdeInfoService.uniqueId = uniqueId;
    IdeInfoService.ideInfo = ideInfo;
  }
}
