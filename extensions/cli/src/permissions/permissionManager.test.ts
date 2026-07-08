import { ToolPermissionManager } from "./permissionManager.js";
import { ToolCallRequest } from "./types.js";

describe("ToolPermissionManager", () => {
  let manager: ToolPermissionManager;

  beforeEach(() => {
    manager = new ToolPermissionManager();
  });

  afterEach(() => {
    // Clean up all listeners
    manager.removeAllListeners();
  });

  describe("Request Management", () => {
    it("should generate unique request IDs", async () => {
      const toolCall1: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test1.txt" },
      };
      const toolCall2: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test2.txt" },
      };

      // Start requests but don't await them
      const promise1 = manager.requestPermission(toolCall1);
      const promise2 = manager.requestPermission(toolCall2);

      const pendingIds = manager.getPendingRequestIds();
      expect(pendingIds).toHaveLength(2);
      expect(pendingIds[0]).not.toBe(pendingIds[1]);

      // Clean up
      manager.approveRequest(pendingIds[0]);
      manager.approveRequest(pendingIds[1]);
      await Promise.all([promise1, promise2]);
    });

    it("should store pending request details correctly", async () => {
      const toolCall: ToolCallRequest = {
        name: "writeFile",
        arguments: { path: "/test.txt", content: "data" },
      };

      const promise = manager.requestPermission(toolCall);
      const pendingIds = manager.getPendingRequestIds();

      expect(pendingIds).toHaveLength(1);

      const requestDetails = manager.getPendingRequest(pendingIds[0]);
      expect(requestDetails).toBeDefined();
      expect(requestDetails?.toolCall).toEqual(toolCall);

      // Clean up
      manager.approveRequest(pendingIds[0]);
      await promise;
    });

    it("should remove request after approval", async () => {
      const toolCall: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test.txt" },
      };

      const promise = manager.requestPermission(toolCall);
      const pendingIds = manager.getPendingRequestIds();
      const requestId = pendingIds[0];

      expect(manager.getPendingRequest(requestId)).toBeDefined();

      const approved = manager.approveRequest(requestId);
      expect(approved).toBe(true);

      const result = await promise;
      expect(result.approved).toBe(true);
      expect(manager.getPendingRequest(requestId)).toBeUndefined();
      expect(manager.getPendingRequestIds()).toHaveLength(0);
    });

    it("should remove request after rejection", async () => {
      const toolCall: ToolCallRequest = {
        name: "runTerminalCommand",
        arguments: { command: "rm -rf /" },
      };

      const promise = manager.requestPermission(toolCall);
      const pendingIds = manager.getPendingRequestIds();
      const requestId = pendingIds[0];

      const rejected = manager.rejectRequest(requestId);
      expect(rejected).toBe(true);

      const result = await promise;
      expect(result.approved).toBe(false);
      expect(manager.getPendingRequest(requestId)).toBeUndefined();
    });

    it("should handle approval of non-existent request", () => {
      const result = manager.approveRequest("non-existent-id");
      expect(result).toBe(false);
    });

    it("should handle rejection of non-existent request", () => {
      const result = manager.rejectRequest("non-existent-id");
      expect(result).toBe(false);
    });

    it("should support remember option for approval", async () => {
      const toolCall: ToolCallRequest = {
        name: "writeFile",
        arguments: { path: "/test.txt" },
      };

      const promise = manager.requestPermission(toolCall);
      const requestId = manager.getPendingRequestIds()[0];

      manager.approveRequest(requestId, true); // Remember = true

      const result = await promise;
      expect(result.approved).toBe(true);
      expect(result.remember).toBe(true);
    });
  });

  describe("Event Emission", () => {
    it("should emit permissionRequested event", () => {
      const toolCall: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test.txt" },
      };

      return new Promise<void>((resolve) => {
        manager.on("permissionRequested", (event) => {
          expect(event.requestId).toBeDefined();
          expect(event.toolCall).toEqual(toolCall);
          resolve();
        });

        manager.requestPermission(toolCall);
      });
    });

    it("should emit permissionResponse event on approval", () => {
      const toolCall: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test.txt" },
      };

      return new Promise<void>((resolve) => {
        manager.on("permissionResponse", (event) => {
          expect(event.approved).toBe(true);
          expect(event.requestId).toBeDefined();
          resolve();
        });

        const promise = manager.requestPermission(toolCall);
        const requestId = manager.getPendingRequestIds()[0];
        manager.approveRequest(requestId);
      });
    });

    it("should emit permissionResponse event on rejection", () => {
      const toolCall: ToolCallRequest = {
        name: "readFile",
        arguments: { path: "/test.txt" },
      };

      return new Promise<void>((resolve) => {
        manager.on("permissionResponse", (event) => {
          expect(event.approved).toBe(false);
          expect(event.requestId).toBeDefined();
          resolve();
        });

        const promise = manager.requestPermission(toolCall);
        const requestId = manager.getPendingRequestIds()[0];
        manager.rejectRequest(requestId);
      });
    });

    it("should emit permissionResponse even for non-existent requests", () => {
      return new Promise<void>((resolve) => {
        manager.on("permissionResponse", (event) => {
          expect(event.approved).toBe(true);
          expect(event.requestId).toBe("fake-id");
          resolve();
        });

        manager.approveRequest("fake-id");
      });
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle multiple concurrent requests", async () => {
      const toolCalls = [
        { name: "readFile", arguments: { path: "/file1.txt" } },
        {
          name: "writeFile",
          arguments: { path: "/file2.txt", content: "data1" },
        },
        { name: "runTerminalCommand", arguments: { command: "ls" } },
      ];

      // Start all requests
      const promises = toolCalls.map((toolCall) =>
        manager.requestPermission(toolCall),
      );

      // Get all pending request IDs
      const pendingIds = manager.getPendingRequestIds();
      expect(pendingIds).toHaveLength(3);

      // Approve first, reject second, approve third
      manager.approveRequest(pendingIds[0]);
      manager.rejectRequest(pendingIds[1]);
      manager.approveRequest(pendingIds[2]);

      // Wait for all to complete
      const results = await Promise.all(promises);

      expect(results[0].approved).toBe(true);
      expect(results[1].approved).toBe(false);
      expect(results[2].approved).toBe(true);

      // All requests should be cleared
      expect(manager.getPendingRequestIds()).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tool call arguments", async () => {
      const toolCall: ToolCallRequest = { name: "exit", arguments: {} };

      const promise = manager.requestPermission(toolCall);
      const requestId = manager.getPendingRequestIds()[0];

      manager.approveRequest(requestId);
      const result = await promise;

      expect(result.approved).toBe(true);
    });

    it("should handle tool calls with complex arguments", async () => {
      const toolCall: ToolCallRequest = {
        name: "complexTool",
        arguments: {
          config: { host: "localhost", port: 3000 },
          options: ["verbose", "debug"],
          metadata: { created: new Date(), version: "1.0.0" },
        },
      };

      const promise = manager.requestPermission(toolCall);
      const requestDetails = manager.getPendingRequest(
        manager.getPendingRequestIds()[0],
      );

      expect(requestDetails?.toolCall.arguments).toEqual(toolCall.arguments);

      manager.approveRequest(manager.getPendingRequestIds()[0]);
      await promise;
    });
  });
});
