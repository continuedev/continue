import {
  ApplyState,
  BrowserSerializedContinueConfig,
  ToolCallState,
} from "core";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CONFIG } from "../redux/slices/configSlice";
import { assembleEditOutcomeData } from "./editOutcomeLogger";

vi.mock("../redux/store", () => ({
  store: {
    getState: vi.fn(() => ({
      session: { history: [] },
      config: {
        config: {
          selectedModelByRole: {
            chat: { provider: "test", model: "test-model" },
          },
        },
      },
    })),
  },
}));

const EMPTY_CONFIG_WITH_TEST_MODEL_SELECTED: BrowserSerializedContinueConfig = {
  ...EMPTY_CONFIG,
  selectedModelByRole: {
    ...EMPTY_CONFIG.selectedModelByRole,
    chat: {
      provider: "test",
      model: "test-model",
      title: "Test model",
      underlyingProviderName: "provider",
    },
  },
};

describe("assembleEditOutcomeData", () => {
  it("should assemble complete edit outcome data correctly", () => {
    const toolCallState: ToolCallState = {
      status: "generating",
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: { name: "test", arguments: "{}" },
      },
      parsedArgs: {},
    };

    const applyState: ApplyState = {
      streamId: "stream-123",
      filepath: "/test/file.ts",
      originalFileContent: "const old = 1;",
      fileContent: "const new = 2;\nconst another = 3;",
    };

    const result = assembleEditOutcomeData(
      [],
      EMPTY_CONFIG_WITH_TEST_MODEL_SELECTED,
      toolCallState,
      applyState,
      true,
    );
    console.log(result);

    expect(result).toMatchObject({
      streamId: "stream-123",
      filepath: "/test/file.ts",
      previousCode: "const old = 1;",
      newCode: "const new = 2;\nconst another = 3;",
      previousCodeLines: 1,
      newCodeLines: 2,
      lineChange: 1,
      accepted: true,
    });
  });

  it("should handle empty code content", () => {
    const toolCallState: ToolCallState = {
      status: "generating",
      toolCallId: "test-id",
      toolCall: {
        id: "test-id",
        type: "function",
        function: { name: "test", arguments: "{}" },
      },
      parsedArgs: {},
    };

    const applyState: ApplyState = {
      streamId: "stream-123",
      filepath: "/test/empty.ts",
      originalFileContent: "",
      fileContent: "",
    };

    const result = assembleEditOutcomeData(
      [],
      EMPTY_CONFIG_WITH_TEST_MODEL_SELECTED,
      toolCallState,
      applyState,
      false,
    );

    expect(result.previousCodeLines).toBe(0);
    expect(result.newCodeLines).toBe(0);
    expect(result.lineChange).toBe(0);
    expect(result.accepted).toBe(false);
  });
});
