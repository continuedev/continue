import { ApplyState, ApplyToFilePayload, ToolCallState } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logAgentModeEditOutcome } from "../../util/editOutcomeLogger";
import {
  selectApplyStateByToolCallId,
  selectToolCallById,
} from "../selectors/selectToolCalls";
import { updateEditStateApplyState } from "../slices/editState";
import {
  acceptToolCall,
  errorToolCall,
  updateApplyState,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { findToolCallById, logToolUsage } from "../util";
import { exitEdit } from "./edit";
import {
  applyForEditTool,
  handleApplyStateUpdate,
} from "./handleApplyStateUpdate";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

// Mock dependencies
vi.mock("../../util/editOutcomeLogger", () => ({
  logAgentModeEditOutcome: vi.fn(),
}));

vi.mock("../selectors/selectToolCalls", () => ({
  selectApplyStateByToolCallId: vi.fn(),
  selectToolCallById: vi.fn(),
}));

vi.mock("../slices/editState", () => ({
  updateEditStateApplyState: vi.fn(() => ({
    type: "editState/updateApplyState",
  })),
}));

vi.mock("../slices/sessionSlice", () => ({
  acceptToolCall: vi.fn(() => ({ type: "session/acceptToolCall" })),
  errorToolCall: vi.fn(() => ({ type: "session/errorToolCall" })),
  updateApplyState: vi.fn(() => ({ type: "session/updateApplyState" })),
  updateToolCallOutput: vi.fn(() => ({ type: "session/updateToolCallOutput" })),
}));

vi.mock("../util", () => ({
  findToolCallById: vi.fn(),
  logToolUsage: vi.fn(),
}));

vi.mock("./edit", () => ({
  exitEdit: vi.fn(() => ({ type: "edit/exitEdit" })),
}));

vi.mock("./streamResponseAfterToolCall", () => ({
  streamResponseAfterToolCall: vi.fn(() => ({
    type: "session/streamResponseAfterToolCall",
  })),
}));

const UNUSED_TOOL_CALL_PARAMS = {
  toolCall: {
    id: "name",
    function: {
      name: "unused",
      arguments: "unused",
    },
    type: "function" as const,
  },
  parsedArgs: {},
};

describe("handleApplyStateUpdate", () => {
  let mockDispatch: any;
  let mockGetState: any;
  let mockExtra: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch = vi.fn();
    mockGetState = vi.fn();
    mockExtra = {
      ideMessenger: {
        post: vi.fn(),
        request: vi.fn(),
      },
    };
  });

  describe("edit mode handling", () => {
    it("should handle edit mode apply state updates", async () => {
      const applyState: ApplyState = {
        streamId: EDIT_MODE_STREAM_ID,
        toolCallId: "test-tool-call",
        status: "streaming",
        filepath: "test.txt",
        numDiffs: 1,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(updateEditStateApplyState).toHaveBeenCalledWith(applyState);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "editState/updateApplyState" }),
      );
    });

    it("should exit edit mode when status is closed", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "done",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      vi.mocked(findToolCallById).mockReturnValue(toolCallState);

      mockGetState.mockReturnValue({
        session: { history: [] },
      });

      const applyState: ApplyState = {
        streamId: EDIT_MODE_STREAM_ID,
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 1,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(logToolUsage).toHaveBeenCalledWith(
        toolCallState,
        true,
        true,
        mockExtra.ideMessenger,
      );
      expect(exitEdit).toHaveBeenCalledWith({});
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "edit/exitEdit" }),
      );
    });
  });

  describe("chat/agent mode handling", () => {
    it("should handle non-edit mode apply state updates", async () => {
      const applyState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "streaming",
        filepath: "test.txt",
        numDiffs: 1,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(updateApplyState).toHaveBeenCalledWith(applyState);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session/updateApplyState" }),
      );
    });
  });

  describe("closed status handling", () => {
    it("should handle accepted tool call closure", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "done",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const newApplyState = { streamId: "chat-stream", numDiffs: 1 };

      vi.mocked(findToolCallById).mockReturnValue(toolCallState);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [newApplyState],
          },
        },
        config: { config: {} },
        ui: { toolSettings: {} },
      });

      // Simulate the "done" event that precedes "closed" in normal flow
      const doneState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "done",
        filepath: "test.txt",
        numDiffs: 1,
      };
      const doneThunk = handleApplyStateUpdate(doneState);
      await doneThunk(mockDispatch, mockGetState, mockExtra);

      const applyState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 0,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(logToolUsage).toHaveBeenCalledWith(
        toolCallState,
        true,
        true,
        mockExtra.ideMessenger,
      );
      expect(logAgentModeEditOutcome).toHaveBeenCalledWith(
        [],
        {},
        toolCallState,
        newApplyState,
        true,
        mockExtra.ideMessenger,
      );
      expect(acceptToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
      expect(streamResponseAfterToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
    });

    it("should handle canceled tool call closure", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "canceled",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const newApplyState = { streamId: "chat-stream-cancel" };

      vi.mocked(findToolCallById).mockReturnValue(toolCallState);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [newApplyState],
          },
        },
        config: { config: {} },
      });

      const applyState: ApplyState = {
        streamId: "chat-stream-cancel",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 0,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(logToolUsage).toHaveBeenCalledWith(
        toolCallState,
        false,
        true,
        mockExtra.ideMessenger,
      );
      expect(logAgentModeEditOutcome).toHaveBeenCalledWith(
        [],
        {},
        toolCallState,
        newApplyState,
        false,
        mockExtra.ideMessenger,
      );
      expect(acceptToolCall).not.toHaveBeenCalled();
      expect(streamResponseAfterToolCall).not.toHaveBeenCalled();
    });

    it("should handle errored tool call closure", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "errored",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const newApplyState = { streamId: "chat-stream-error" };

      vi.mocked(findToolCallById).mockReturnValue(toolCallState);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [newApplyState],
          },
        },
        config: { config: {} },
      });

      const applyState: ApplyState = {
        streamId: "chat-stream-error",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 0,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(acceptToolCall).not.toHaveBeenCalled();
      expect(streamResponseAfterToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
    });

    it("should reject closure that skipped done (bail-out path)", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const newApplyState = { streamId: "bail-stream" };

      vi.mocked(findToolCallById).mockReturnValue(toolCallState);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [newApplyState],
          },
        },
        config: { config: {} },
      });

      // No "done" event dispatched — simulates handler bail-out
      const applyState: ApplyState = {
        streamId: "bail-stream",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 0,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(acceptToolCall).not.toHaveBeenCalled();
      expect(updateToolCallOutput).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
        contextItems: [
          {
            name: "Edit Failed",
            content:
              "Failed to edit test.txt. To continue working with the file, read it again to see the most up-to-date contents",
            description: "",
            hidden: true,
          },
        ],
      });
      expect(streamResponseAfterToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
    });

    it("should handle closure when no tool call found", async () => {
      vi.mocked(findToolCallById).mockReturnValue(undefined);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [],
          },
        },
      });

      const applyState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 1,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(logToolUsage).not.toHaveBeenCalled();
      expect(acceptToolCall).not.toHaveBeenCalled();
      expect(streamResponseAfterToolCall).not.toHaveBeenCalled();
    });

    it("should handle closure when no apply state found", async () => {
      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "done",
        ...UNUSED_TOOL_CALL_PARAMS,
      };

      vi.mocked(findToolCallById).mockReturnValue(toolCallState);
      mockGetState.mockReturnValue({
        session: {
          history: [],
          codeBlockApplyStates: {
            states: [],
          },
        },
        config: { config: {} },
        ui: { toolSettings: {} },
      });

      // Simulate the "done" event
      const doneState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "done",
        filepath: "test.txt",
        numDiffs: 1,
      };
      const doneThunk = handleApplyStateUpdate(doneState);
      await doneThunk(mockDispatch, mockGetState, mockExtra);

      const applyState: ApplyState = {
        streamId: "chat-stream",
        toolCallId: "test-tool-call",
        status: "closed",
        filepath: "test.txt",
        numDiffs: 0,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(logAgentModeEditOutcome).not.toHaveBeenCalled();
      expect(acceptToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle apply state without toolCallId", async () => {
      const applyState: ApplyState = {
        streamId: "chat-stream",
        status: "streaming",
        filepath: "test.txt",
        numDiffs: 1,
      };

      const thunk = handleApplyStateUpdate(applyState);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(updateApplyState).toHaveBeenCalledWith(applyState);
      expect(acceptToolCall).not.toHaveBeenCalled();
      expect(streamResponseAfterToolCall).not.toHaveBeenCalled();
    });

    it("should handle different status values", async () => {
      const statusValues: ApplyState["status"][] = [
        "streaming",
        "done",
        "closed",
      ];

      for (const status of statusValues) {
        vi.clearAllMocks();

        vi.mocked(findToolCallById).mockReturnValue(undefined);
        mockGetState.mockReturnValue({
          session: {
            history: [],
            codeBlockApplyStates: { states: [] },
          },
          ui: { toolSettings: {} },
        });

        const applyState: ApplyState = {
          streamId: `chat-stream-${status}`,
          toolCallId: "test-tool-call",
          status,
          filepath: "test.txt",
          numDiffs: 1,
        };

        const thunk = handleApplyStateUpdate(applyState);
        await thunk(mockDispatch, mockGetState, mockExtra);

        expect(updateApplyState).toHaveBeenCalledWith(applyState);
      }
    });
  });
});

describe("applyForEditTool", () => {
  let mockDispatch: any;
  let mockGetState: any;
  let mockExtra: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch = vi.fn();
    mockGetState = vi.fn();
    mockExtra = {
      ideMessenger: {
        request: vi.fn(),
      },
    };
  });

  describe("successful application", () => {
    it("should successfully apply changes to file", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      mockExtra.ideMessenger.request.mockResolvedValue({ status: "success" });

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(updateApplyState).toHaveBeenCalledWith({
        streamId: "test-stream",
        toolCallId: "test-tool-call",
        status: "not-started",
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "session/updateApplyState" }),
      );
      expect(mockExtra.ideMessenger.request).toHaveBeenCalledWith(
        "applyToFile",
        payload,
      );
    });
  });

  describe("error handling", () => {
    it("should handle IDE messenger request failure", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "streaming",
        streamId: "test-stream",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
      expect(updateToolCallOutput).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
        contextItems: [
          {
            icon: "problems",
            name: "Apply Error",
            description: "Failed to apply changes",
            content: `Error editing file: failed to apply changes to file.\n\nPlease try again with correct args or notify the user and request further instructions.`,
            hidden: false,
          },
        ],
      });
    });

    it("should handle IDE messenger error response", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "streaming",
        streamId: "test-stream",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockResolvedValue({ status: "error" });

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
      expect(updateToolCallOutput).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
        contextItems: [
          {
            icon: "problems",
            name: "Apply Error",
            description: "Failed to apply changes",
            content: `Error editing file: failed to apply changes to file.\n\nPlease try again with correct args or notify the user and request further instructions.`,
            hidden: false,
          },
        ],
      });
    });

    it("should not error if tool call is not in calling state", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "done",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "streaming",
        streamId: "test-stream",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).not.toHaveBeenCalled();
      expect(updateToolCallOutput).not.toHaveBeenCalled();
    });

    it("should not error if apply state is closed", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "closed",
        streamId: "test-stream",
      }; // Already closed

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).not.toHaveBeenCalled();
      expect(updateToolCallOutput).not.toHaveBeenCalled();
    });

    it("should not error if tool call state is not found", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      vi.mocked(selectToolCallById).mockReturnValue(undefined); // Tool call not found
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue({
        status: "streaming",
        streamId: "test-stream",
      });
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).not.toHaveBeenCalled();
      expect(updateToolCallOutput).not.toHaveBeenCalled();
    });

    it("should not error if apply state is not found", async () => {
      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(undefined); // Apply state not found
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      expect(errorToolCall).not.toHaveBeenCalled();
      expect(updateToolCallOutput).not.toHaveBeenCalled();
    });
  });

  describe("timeout handling", () => {
    it("should dispatch error on apply timeout", async () => {
      vi.useFakeTimers();

      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "not-started",
        streamId: "test-stream",
        toolCallId: "test-tool-call",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      // Simulate the apply request never completing (never calling a callback)
      let resolveApplyRequest: (value: any) => void;
      const applyPromise = new Promise((resolve) => {
        resolveApplyRequest = resolve;
      });
      mockExtra.ideMessenger.request.mockReturnValue(applyPromise);

      const thunk = applyForEditTool(payload);
      const thunkPromise = thunk(mockDispatch, mockGetState, mockExtra);

      // Advance time past the timeout (60 seconds)
      vi.advanceTimersByTime(61_000);

      // Allow promises to settle
      await vi.runAllTimersAsync();

      expect(errorToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });
      expect(updateToolCallOutput).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
        contextItems: [
          {
            icon: "problems",
            name: "Apply Timeout",
            description: "Edit operation timed out",
            content:
              "Error editing file: the apply operation did not complete within the expected time. The file may not have been modified. Please try again or use a different approach.\n\nPlease try something else or request further instructions.",
            hidden: false,
          },
        ],
      });

      // Verify that a dispatch with type 'apply/updateState' was made (for handleApplyStateUpdate)
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining("apply"),
        }),
      );

      vi.useRealTimers();
    });

    it("should not trigger timeout when apply completes normally", async () => {
      vi.useFakeTimers();
      vi.clearAllMocks();

      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call-normal",
        streamId: "test-stream-normal",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call-normal",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "not-started",
        streamId: "test-stream-normal",
        toolCallId: "test-tool-call-normal",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      // Simulate successful apply request
      mockExtra.ideMessenger.request.mockResolvedValue({ status: "success" });

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      // Simulate the apply state reaching "closed" status via the normal flow
      // This would happen when VS Code sends back the status update
      const closedApplyState: ApplyState = {
        status: "closed",
        streamId: "test-stream-normal",
        toolCallId: "test-tool-call-normal",
      };
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(closedApplyState);

      // Advance time past the timeout
      vi.advanceTimersByTime(61_000);

      // The timeout should not have dispatched error because the apply state reached "closed"
      expect(errorToolCall).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should clear timeout on immediate error", async () => {
      vi.useFakeTimers();

      const payload: ApplyToFilePayload & { toolCallId: string } = {
        toolCallId: "test-tool-call",
        streamId: "test-stream",
        filepath: "test.txt",
        text: "new content",
        isSearchAndReplace: true,
      };

      const toolCallState: ToolCallState = {
        toolCallId: "test-tool-call",
        status: "calling",
        ...UNUSED_TOOL_CALL_PARAMS,
      };
      const applyState: ApplyState = {
        status: "not-started",
        streamId: "test-stream",
        toolCallId: "test-tool-call",
      };

      vi.mocked(selectToolCallById).mockReturnValue(toolCallState);
      vi.mocked(selectApplyStateByToolCallId).mockReturnValue(applyState);
      mockGetState.mockReturnValue({});

      mockExtra.ideMessenger.request.mockRejectedValue(
        new Error("Request failed"),
      );

      const thunk = applyForEditTool(payload);
      await thunk(mockDispatch, mockGetState, mockExtra);

      // Check that error was dispatched (from immediate error, not timeout)
      expect(errorToolCall).toHaveBeenCalledWith({
        toolCallId: "test-tool-call",
      });

      const callCountAfterError = vi.mocked(errorToolCall).mock.calls.length;

      // Advance time past the timeout
      vi.advanceTimersByTime(61_000);

      // Error should only have been dispatched once (from the immediate error)
      expect(vi.mocked(errorToolCall).mock.calls.length).toBe(
        callCountAfterError,
      );

      vi.useRealTimers();
    });
  });

  describe("edge cases", () => {
    it("should handle different payload types", async () => {
      const payloads: (ApplyToFilePayload & { toolCallId: string })[] = [
        {
          toolCallId: "test-1",
          streamId: "stream-1",
          filepath: "file1.txt",
          text: "content 1",
          isSearchAndReplace: false,
        },
        {
          toolCallId: "test-2",
          streamId: "stream-2",
          filepath: "file2.js",
          text: "content 2",
          isSearchAndReplace: true,
        },
      ];

      for (const payload of payloads) {
        vi.clearAllMocks();
        mockExtra.ideMessenger.request.mockResolvedValue({ status: "success" });

        const thunk = applyForEditTool(payload);
        await thunk(mockDispatch, mockGetState, mockExtra);

        expect(mockExtra.ideMessenger.request).toHaveBeenCalledWith(
          "applyToFile",
          payload,
        );
        expect(updateApplyState).toHaveBeenCalledWith({
          streamId: payload.streamId,
          toolCallId: payload.toolCallId,
          status: "not-started",
        });
      }
    });
  });
});
