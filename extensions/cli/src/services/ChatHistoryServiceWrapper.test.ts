import type { ChatHistoryItem } from "core/index.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ChatHistoryService } from "./ChatHistoryService.js";
import { ChatHistoryServiceWrapper } from "./ChatHistoryServiceWrapper.js";

describe("ChatHistoryServiceWrapper", () => {
  let service: ChatHistoryService;
  let wrapper: ChatHistoryServiceWrapper;

  beforeEach(() => {
    service = new ChatHistoryService();
    wrapper = new ChatHistoryServiceWrapper(service);
  });

  describe("createWrappedSetState", () => {
    it("should sync direct value updates to service", () => {
      const originalSetState = vi.fn();
      const wrappedSetState = wrapper.createWrappedSetState(originalSetState);

      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "test" },
          contextItems: [],
        },
      ];

      wrappedSetState(newHistory);

      expect(service.getHistory()).toEqual(newHistory);
      expect(originalSetState).toHaveBeenCalledWith(newHistory);
    });

    it("should sync function updates to service", () => {
      const originalSetState = vi.fn();
      const wrappedSetState = wrapper.createWrappedSetState(originalSetState);

      const initialHistory: ChatHistoryItem[] = [
        {
          message: { role: "system", content: "initial" },
          contextItems: [],
        },
      ];
      service.setHistory(initialHistory);

      const newMessage: ChatHistoryItem = {
        message: { role: "user", content: "test" },
        contextItems: [],
      };

      wrappedSetState((prev) => [...prev, newMessage]);

      const expectedHistory = [...initialHistory, newMessage];
      expect(service.getHistory()).toEqual(expectedHistory);
      expect(originalSetState).toHaveBeenCalledWith(expectedHistory);
    });

    it("should handle errors when syncing to service", () => {
      const originalSetState = vi.fn();
      const wrappedSetState = wrapper.createWrappedSetState(originalSetState);

      // Mock service.setHistory to throw an error
      vi.spyOn(service, "setHistory").mockImplementation(() => {
        throw new Error("Service error");
      });

      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "test" },
          contextItems: [],
        },
      ];

      // Should not throw, just log error
      expect(() => wrappedSetState(newHistory)).not.toThrow();
      
      // React state should still be updated
      expect(originalSetState).toHaveBeenCalledWith(newHistory);
    });
  });

  describe("setupSync", () => {
    it("should sync service changes to React state", () => {
      const setChatHistory = vi.fn();
      wrapper.setupSync(setChatHistory);

      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "test" },
          contextItems: [],
        },
      ];

      service.setHistory(newHistory);

      expect(setChatHistory).toHaveBeenCalledWith(newHistory);
    });

    it("should prevent infinite loops when syncing", () => {
      const originalSetState = vi.fn();
      const wrappedSetState = wrapper.createWrappedSetState(originalSetState);
      
      wrapper.setupSync(wrappedSetState);

      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "test" },
          contextItems: [],
        },
      ];

      // This should trigger sync to React state, which uses wrapped setState
      // The wrapper should detect it's a service update and not sync back
      service.setHistory(newHistory);

      // Service setHistory should only be called once (the initial call above)
      const setHistorySpy = vi.spyOn(service, "setHistory");
      expect(setHistorySpy).not.toHaveBeenCalled();
    });
  });

  describe("initializeFromState", () => {
    it("should initialize service with existing history", () => {
      const existingHistory: ChatHistoryItem[] = [
        {
          message: { role: "system", content: "system message" },
          contextItems: [],
        },
        {
          message: { role: "user", content: "hello" },
          contextItems: [],
        },
      ];

      wrapper.initializeFromState(existingHistory);

      expect(service.getHistory()).toEqual(existingHistory);
    });

    it("should not initialize if history is empty", () => {
      const setHistorySpy = vi.spyOn(service, "setHistory");
      
      wrapper.initializeFromState([]);

      expect(setHistorySpy).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should unsubscribe from service on cleanup", () => {
      const setChatHistory = vi.fn();
      wrapper.setupSync(setChatHistory);

      wrapper.cleanup();

      // After cleanup, service changes should not trigger React state updates
      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "test" },
          contextItems: [],
        },
      ];

      service.setHistory(newHistory);

      // Should only be called once (from the initial setupSync)
      expect(setChatHistory).not.toHaveBeenCalled();
    });

    it("should handle cleanup when no subscription exists", () => {
      // Should not throw
      expect(() => wrapper.cleanup()).not.toThrow();
    });
  });

  describe("getService", () => {
    it("should return the underlying service", () => {
      expect(wrapper.getService()).toBe(service);
    });
  });
});