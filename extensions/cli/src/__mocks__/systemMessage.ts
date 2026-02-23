import { vi } from "vitest";

export const constructSystemMessage = vi
  .fn()
  .mockResolvedValue(
    "You are an agent in the Continue CLI. Given the user's prompt, you should use the tools available to you to answer the user's question.",
  );
