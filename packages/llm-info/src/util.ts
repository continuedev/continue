import { LlmInfo } from "./types.js";

export function llms(
  provider: string,
  infos: Omit<LlmInfo, "provider">[],
): LlmInfo[] {
  return infos.map((info) => ({
    ...info,
    provider,
  }));
}
