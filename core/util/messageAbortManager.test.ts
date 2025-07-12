import { messageAbortManager } from "./messageAbortManager";

describe("MessageAbortManager", () => {
  describe("runWithAbortController", () => {
    it("should handle Promise success", async () => {
      const mockTask = jest.fn((_abortController: AbortController) =>
        Promise.resolve("success"),
      );

      const result = await messageAbortManager.runWithAbortController(
        "test-id-1",
        mockTask,
      );

      expect(result).toBe("success");
      expect(mockTask).toHaveBeenCalledWith(expect.any(AbortController));
      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });

    it("should handle Promise failure", async () => {
      const mockError = new Error("test error");
      const mockTask = jest.fn((_abortController: AbortController) =>
        Promise.reject(mockError),
      );

      await expect(
        messageAbortManager.runWithAbortController("test-id-2", mockTask),
      ).rejects.toThrow(mockError);

      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });

    it("should handle AsyncGenerator", async () => {
      async function* mockGenerator(_abortController: AbortController) {
        yield 1;
        yield 2;
      }

      const result = messageAbortManager.runWithAbortController(
        "test-id-3",
        mockGenerator,
      );

      const values = [];
      for await (const val of result) {
        values.push(val);
      }

      expect(values).toEqual([1, 2]);
      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });

    it("should abort AsyncGenerator when signal aborted", async () => {
      const mockError = new Error("test error");
      const mockAbortHandler = jest.fn();

      async function* mockGenerator(abortController: AbortController) {
        try {
          yield 1;
          await new Promise((_, reject) => {
            if (abortController.signal.aborted) {
              reject(mockError);
            }
            abortController.signal.addEventListener("abort", () => {
              reject(mockError);
            });
          });
          yield 2;
        } finally {
          mockAbortHandler();
        }
      }

      const msgId = "test-id-4";

      const result = messageAbortManager.runWithAbortController(
        msgId,
        mockGenerator,
      );

      const first = await result.next();
      messageAbortManager.abortById(msgId);

      expect(first.value).toBe(1);
      await expect(result.next()).rejects.toThrow(mockError);
      expect(mockAbortHandler).toHaveBeenCalled();
      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });
  });

  describe("Controller cleanup", () => {
    it("should auto-cleanup on task completion", async () => {
      await messageAbortManager.runWithAbortController("test-id-5", () =>
        Promise.resolve(),
      );
      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });

    it("should auto-cleanup on generator completion", async () => {
      async function* emptyGen() {}
      const gen = messageAbortManager.runWithAbortController(
        "test-id-6",
        emptyGen,
      );
      await gen.next();
      expect(messageAbortManager["messageAbortControllers"].size).toBe(0);
    });
  });
});
