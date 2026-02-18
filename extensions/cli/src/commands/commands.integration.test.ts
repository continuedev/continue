import type { AssistantConfig } from "@continuedev/sdk";
import { describe, expect, it } from "vitest";

import { getAllSlashCommands } from "./commands.js";

describe("Slash Commands Integration", () => {
  const mockAssistant: AssistantConfig = {
    name: "test-assistant",
    version: "1.0.0",
    prompts: [
      {
        name: "test-prompt",
        prompt: "Test prompt",
        description: "Test prompt description",
      },
    ],
  };

  describe("System Commands Registration", () => {
    it("should include all system commands in the commands list", () => {
      const commands = getAllSlashCommands(mockAssistant);
      const commandNames = commands.map((cmd) => cmd.name);

      // Check that system commands are present (mode commands have been removed)
      expect(commandNames).toContain("help");
      expect(commandNames).toContain("clear");
      expect(commandNames).toContain("exit");
      expect(commandNames).toContain("login");
      expect(commandNames).toContain("logout");
      expect(commandNames).toContain("whoami");

      expect(commandNames).toContain("model");
      expect(commandNames).toContain("config");
    });

    it("should include assistant prompt commands", () => {
      const commands = getAllSlashCommands(mockAssistant);
      const commandNames = commands.map((cmd) => cmd.name);

      expect(commandNames).toContain("test-prompt");
    });

    it("should categorize system commands correctly", () => {
      const commands = getAllSlashCommands(mockAssistant);
      const systemCommands = commands.filter((cmd) =>
        [
          "help",
          "clear",
          "exit",
          "login",
          "logout",
          "whoami",
          "model",
          "config",
        ].includes(cmd.name),
      );

      systemCommands.forEach((cmd) => {
        expect(cmd.category).toBe("system");
      });
    });

    it("should categorize assistant commands correctly", () => {
      const commands = getAllSlashCommands(mockAssistant);
      const assistantCommands = commands.filter(
        (cmd) => cmd.name === "test-prompt",
      );

      assistantCommands.forEach((cmd) => {
        expect(cmd.category).toBe("assistant");
      });
    });

    it("should only show remote mode commands in remote mode", () => {
      const commands = getAllSlashCommands(mockAssistant, {
        isRemoteMode: true,
      });
      const commandNames = commands.map((cmd) => cmd.name);

      // In remote mode, only remote commands should be available
      expect(commandNames).toContain("exit");
      expect(commandNames).toContain("diff");
      expect(commandNames).toContain("apply");
      expect(commandNames).toHaveLength(3);
    });
  });
});
