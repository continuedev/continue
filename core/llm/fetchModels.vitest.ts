import { describe, expect, it, vi } from "vitest";
import { fetchModels } from "./fetchModels.js";

vi.mock("./llms/index.js", () => ({
  LLMClasses: [],
  llmFromProviderAndOptions: vi.fn(),
}));
vi.mock("@continuedev/openai-adapters", () => ({
  fetchAceDataCloudCatalog: vi.fn(async () => [
    {
      id: "new-family-chat",
      type: "chat",
      label: "New family",
      capabilities: ["vision"],
    },
    { id: "another-model", type: "chat" },
  ]),
}));

describe("Ace Data Cloud picker discovery", () => {
  it("passes every catalog ID and only declared metadata to the picker without a key", async () => {
    expect(await fetchModels("acedatacloud")).toEqual([
      {
        name: "New family (new-family-chat)",
        modelId: "new-family-chat",
        icon: "acedatacloud.png",
        supportsImages: true,
      },
      {
        name: "another-model",
        modelId: "another-model",
        icon: "acedatacloud.png",
        supportsImages: undefined,
      },
    ]);
  });
});
