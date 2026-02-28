import { vi } from "vitest";

export const constructSystemMessage = vi.fn().mockResolvedValue([
  {
    type: "text",
    text: "You are an agent in the Continue CLI. Given the user's prompt, you should use the tools available to you to answer the user's question.",
  },
]);

export const flattenSystemMessage = vi
  .fn()
  .mockImplementation((blocks: Array<{ type: string; text: string }>) =>
    blocks.map((b) => b.text).join("\n\n"),
  );
