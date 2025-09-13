import { describe, expect, it, vi, beforeEach } from "vitest";

import { handleSlashCommands } from "./slashCommands.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("Remote mode slash commands", () => {
  const mockAssistant = {
    name: "test",
    version: "1.0.0",
    prompts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/diff command", () => {
    it("should return error when not in remote mode", async () => {
      const result = await handleSlashCommands("/diff", mockAssistant);

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("only available in remote mode"),
      });
    });

    it("should fetch diff content from remote URL", async () => {
      const mockDiff = "diff --git a/file.txt b/file.txt\n+added line";
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockDiff),
      });

      const result = await handleSlashCommands("/diff", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });

      expect(fetch).toHaveBeenCalledWith("http://localhost:3000/diff");
      expect(result).toEqual({
        exit: false,
        diffContent: mockDiff,
      });
    });

    it("should handle empty diff response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const result = await handleSlashCommands("/diff", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("No changes to display"),
      });
    });

    it("should handle fetch errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await handleSlashCommands("/diff", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("Failed to fetch diff"),
      });
    });
  });

  describe("/apply command", () => {
    it("should return error when not in remote mode", async () => {
      const result = await handleSlashCommands("/apply", mockAssistant);

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("only available in remote mode"),
      });
    });

    it("should handle empty diff response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const result = await handleSlashCommands("/apply", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("No changes to apply"),
      });
    });

    it("should handle fetch errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await handleSlashCommands("/apply", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });

      expect(result).toEqual({
        exit: false,
        output: expect.stringContaining("Failed to fetch diff"),
      });
    });
  });
});
