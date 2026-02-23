import { LlmInfo } from "../types.js";

export const OsLlms: Omit<LlmInfo, "provider">[] = [
  {
    model: "starcoder2:3b",
    displayName: "StarCoder 2 3B",
    contextLength: 8192,
  },
];
