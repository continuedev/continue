import { describe, expect, it, vi, beforeEach } from "vitest";

import { handleSlashCommands } from "./slashCommands.js";

describe("Remote mode slash commands", () => {
  const mockAssistant = {
    name: "test",
    version: "1.0.0",
    prompts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/diff and /apply commands", () => {
    it("should not be handled by handleSlashCommands - these are handled by TUI layer", async () => {
      // /diff and /apply are handled by handleSpecialCommands in useChat.helpers.ts,
      // not by the general slash command system. These commands are intercepted
      // at the TUI layer before reaching handleSlashCommands, so handleSlashCommands
      // should return null (no match) for these commands.

      const diffResult = await handleSlashCommands("/diff", mockAssistant);
      expect(diffResult).toBe(null);

      const applyResult = await handleSlashCommands("/apply", mockAssistant);
      expect(applyResult).toBe(null);
    });

    it("should return unknown command for remote commands when called directly", async () => {
      // When called directly (bypassing handleSpecialCommands), /diff and /apply
      // should return "Unknown command" because they're listed in REMOTE_MODE_SLASH_COMMANDS
      // for UI display but not implemented as handlers.

      const diffResult = await handleSlashCommands("/diff", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });
      expect(diffResult).toEqual({
        output: "Unknown command: diff",
      });

      const applyResult = await handleSlashCommands("/apply", mockAssistant, {
        remoteUrl: "http://localhost:3000",
        isRemoteMode: true,
      });
      expect(applyResult).toEqual({
        output: "Unknown command: apply",
      });
    });
  });
});
