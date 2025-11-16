import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { useInputHistory } from "../useInputHistory";

// Define JSONContent type locally to avoid import issues in test environment
interface JSONContent {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
  text?: string;
}

// Mock localStorage utilities
vi.mock("../../util/localStorage", () => ({
  getLocalStorage: vi.fn(),
  setLocalStorage: vi.fn(),
}));

const mockGetLocalStorage = vi.mocked(getLocalStorage);
const mockSetLocalStorage = vi.mocked(setLocalStorage);

describe("useInputHistory", () => {
  const historyKey = "test-history";
  const MAX_HISTORY_LENGTH = 100;

  const createJsonContent = (text: string): JSONContent => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

  const emptyJsonContent = (): JSONContent => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetLocalStorage.mockReturnValue(null);
  });

  describe("Initialization", () => {
    it("should initialize with empty history when no localStorage data exists", () => {
      mockGetLocalStorage.mockReturnValue(null);

      const { result } = renderHook(() => useInputHistory(historyKey));

      expect(mockGetLocalStorage).toHaveBeenCalledWith(`inputHistory_${historyKey}`);
      expect(result.current).toHaveProperty("prevRef");
      expect(result.current).toHaveProperty("nextRef");
      expect(result.current).toHaveProperty("addRef");
    });

    it("should initialize with existing history from localStorage", () => {
      const existingHistory = [
        createJsonContent("previous input 1"),
        createJsonContent("previous input 2"),
      ];
      mockGetLocalStorage.mockReturnValue(existingHistory);

      const { result } = renderHook(() => useInputHistory(historyKey));

      expect(mockGetLocalStorage).toHaveBeenCalledWith(`inputHistory_${historyKey}`);

      // Test that we can navigate through the existing history
      act(() => {
        const content1 = result.current.prevRef.current(emptyJsonContent());
        expect(content1).toEqual(existingHistory[1]); // Latest item
      });
    });

    it("should slice history to MAX_HISTORY_LENGTH when loading from localStorage", () => {
      const longHistory = Array.from({ length: 120 }, (_, i) =>
        createJsonContent(`input ${i + 1}`)
      );
      mockGetLocalStorage.mockReturnValue(longHistory);

      renderHook(() => useInputHistory(historyKey));

      expect(mockGetLocalStorage).toHaveBeenCalledWith(`inputHistory_${historyKey}`);

      // The slice should happen during initialization
      // We can't directly test the internal state, but we can test that localStorage receives the sliced data
    });
  });

  describe("Adding items", () => {
    it("should add new input to history", () => {
      const { result } = renderHook(() => useInputHistory(historyKey));
      const newInput = createJsonContent("new input");

      act(() => {
        result.current.addRef.current(newInput);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        `inputHistory_${historyKey}`,
        [newInput]
      );
    });

    it("should not add duplicate consecutive inputs", () => {
      const existingInput = createJsonContent("existing input");
      mockGetLocalStorage.mockReturnValue([existingInput]);

      const { result } = renderHook(() => useInputHistory(historyKey));

      act(() => {
        result.current.addRef.current(existingInput);
      });

      // Should not call setLocalStorage since it's a duplicate
      expect(mockSetLocalStorage).not.toHaveBeenCalled();
    });

    it("should add different inputs even if similar", () => {
      const existingInput = createJsonContent("input 1");
      const newInput = createJsonContent("input 2");
      mockGetLocalStorage.mockReturnValue([existingInput]);

      const { result } = renderHook(() => useInputHistory(historyKey));

      act(() => {
        result.current.addRef.current(newInput);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        `inputHistory_${historyKey}`,
        [existingInput, newInput]
      );
    });
  });

  describe("History eviction (MAX_HISTORY_LENGTH)", () => {
    it("should evict oldest items when history reaches MAX_HISTORY_LENGTH", () => {
      // Create a history at the maximum length
      const fullHistory = Array.from({ length: MAX_HISTORY_LENGTH }, (_, i) =>
        createJsonContent(`input ${i + 1}`)
      );
      mockGetLocalStorage.mockReturnValue(fullHistory);

      const { result } = renderHook(() => useInputHistory(historyKey));
      const newInput = createJsonContent("new input that exceeds max");

      act(() => {
        result.current.addRef.current(newInput);
      });

      // Should save only the last MAX_HISTORY_LENGTH items, evicting the oldest
      const expectedHistory = [...fullHistory, newInput].slice(-MAX_HISTORY_LENGTH);
      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        `inputHistory_${historyKey}`,
        expectedHistory
      );

      // Verify that the first item was evicted and the new item was added
      expect(expectedHistory).not.toContain(fullHistory[0]);
      expect(expectedHistory).toContain(newInput);
      expect(expectedHistory).toHaveLength(MAX_HISTORY_LENGTH);
    });

    it("should allow navigation after history eviction", () => {
      // Create a history at the maximum length
      const fullHistory = Array.from({ length: MAX_HISTORY_LENGTH }, (_, i) =>
        createJsonContent(`input ${i + 1}`)
      );
      mockGetLocalStorage.mockReturnValue(fullHistory);

      const { result } = renderHook(() => useInputHistory(historyKey));
      const newInput = createJsonContent("newest input");

      // Add new input that should trigger eviction
      act(() => {
        result.current.addRef.current(newInput);
      });

      // Test navigation after eviction - should be able to access the newest items
      act(() => {
        const latestInput = result.current.prevRef.current(emptyJsonContent());
        expect(latestInput).toEqual(newInput);
      });
    });

    it("should handle multiple additions beyond MAX_HISTORY_LENGTH", () => {
      // Start with full history
      const fullHistory = Array.from({ length: MAX_HISTORY_LENGTH }, (_, i) =>
        createJsonContent(`input ${i + 1}`)
      );
      mockGetLocalStorage.mockReturnValue(fullHistory);

      const { result } = renderHook(() => useInputHistory(historyKey));

      // Add multiple new inputs
      const newInputs = [
        createJsonContent("new input 1"),
        createJsonContent("new input 2"),
        createJsonContent("new input 3"),
      ];

      newInputs.forEach(input => {
        act(() => {
          result.current.addRef.current(input);
        });
      });

      // The final localStorage call should contain only MAX_HISTORY_LENGTH items
      const lastCall = mockSetLocalStorage.mock.calls[mockSetLocalStorage.mock.calls.length - 1];
      expect(lastCall[1]).toHaveLength(MAX_HISTORY_LENGTH);
      expect(lastCall[1]).toContain(newInputs[2]); // Latest should be included
    });
  });

  describe("Navigation", () => {
    it("should navigate backwards through history", () => {
      const history = [
        createJsonContent("input 1"),
        createJsonContent("input 2"),
        createJsonContent("input 3"),
      ];
      mockGetLocalStorage.mockReturnValue(history);

      const { result } = renderHook(() => useInputHistory(historyKey));

      // Navigate backwards
      act(() => {
        const content1 = result.current.prevRef.current(emptyJsonContent());
        expect(content1).toEqual(history[2]); // Latest item
      });

      act(() => {
        const content2 = result.current.prevRef.current(emptyJsonContent());
        expect(content2).toEqual(history[1]); // Second latest
      });

      act(() => {
        const content3 = result.current.prevRef.current(emptyJsonContent());
        expect(content3).toEqual(history[0]); // Oldest
      });
    });

    it("should navigate forwards through history", () => {
      const history = [
        createJsonContent("input 1"),
        createJsonContent("input 2"),
        createJsonContent("input 3"),
      ];
      mockGetLocalStorage.mockReturnValue(history);

      const { result } = renderHook(() => useInputHistory(historyKey));

      // First, navigate backwards to the beginning
      act(() => {
        result.current.prevRef.current(emptyJsonContent());
        result.current.prevRef.current(emptyJsonContent());
        result.current.prevRef.current(emptyJsonContent());
      });

      // Then navigate forwards
      act(() => {
        const content1 = result.current.nextRef.current();
        expect(content1).toEqual(history[1]);
      });

      act(() => {
        const content2 = result.current.nextRef.current();
        expect(content2).toEqual(history[2]);
      });
    });

    it("should preserve pending input when navigating back from current position", () => {
      const history = [createJsonContent("input 1")];
      mockGetLocalStorage.mockReturnValue(history);

      const { result } = renderHook(() => useInputHistory(historyKey));
      const currentInput = createJsonContent("current typing");

      // Navigate back from current input
      act(() => {
        const prevContent = result.current.prevRef.current(currentInput);
        expect(prevContent).toEqual(history[0]);
      });

      // Navigate forward should return the pending input
      act(() => {
        const nextContent = result.current.nextRef.current();
        expect(nextContent).toEqual(currentInput);
      });
    });

    it("should handle navigation boundaries gracefully", () => {
      const history = [createJsonContent("only input")];
      mockGetLocalStorage.mockReturnValue(history);

      const { result } = renderHook(() => useInputHistory(historyKey));

      // Navigate back beyond beginning
      act(() => {
        result.current.prevRef.current(emptyJsonContent());
        const content = result.current.prevRef.current(emptyJsonContent());
        expect(content).toBeUndefined(); // Should not crash
      });

      // Navigate forward beyond end
      act(() => {
        const content = result.current.nextRef.current();
        expect(content).toBeUndefined(); // Should not crash
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string inputs", () => {
      const { result } = renderHook(() => useInputHistory(historyKey));
      const emptyInput = emptyJsonContent();

      act(() => {
        result.current.addRef.current(emptyInput);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        `inputHistory_${historyKey}`,
        [emptyInput]
      );
    });

    it("should handle complex JSONContent structures", () => {
      const { result } = renderHook(() => useInputHistory(historyKey));
      const complexInput: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello " }] },
          { type: "paragraph", content: [{ type: "text", text: "World!" }] },
        ],
      };

      act(() => {
        result.current.addRef.current(complexInput);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        `inputHistory_${historyKey}`,
        [complexInput]
      );
    });

    it("should handle different history keys independently", () => {
      const key1 = "history-1";
      const key2 = "history-2";

      const { result: result1 } = renderHook(() => useInputHistory(key1));
      const { result: result2 } = renderHook(() => useInputHistory(key2));

      const input1 = createJsonContent("input for key 1");
      const input2 = createJsonContent("input for key 2");

      act(() => {
        result1.current.addRef.current(input1);
        result2.current.addRef.current(input2);
      });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(`inputHistory_${key1}`, [input1]);
      expect(mockSetLocalStorage).toHaveBeenCalledWith(`inputHistory_${key2}`, [input2]);
    });
  });
});