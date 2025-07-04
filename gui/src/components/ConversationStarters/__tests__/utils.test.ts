import { SlashCommandDescWithSource } from "core";
import { sortCommandsByBookmarkStatus } from "../utils";

describe("sortCommandsByBookmarkStatus", () => {
  const mockCommands: SlashCommandDescWithSource[] = [
    {
      name: "command1",
      description: "First command",
      prompt: "This is command 1",
      source: "built-in",
      isLegacy: false,
    },
    {
      name: "command2",
      description: "Second command",
      prompt: "This is command 2",
      source: "built-in",
      isLegacy: false,
    },
    {
      name: "command3",
      description: "Third command",
      prompt: "This is command 3",
      source: "built-in",
      isLegacy: false,
    },
    {
      name: "command4",
      description: "Fourth command",
      prompt: "This is command 4",
      source: "built-in",
      isLegacy: false,
    },
  ];

  it("should return commands in the same order when no bookmarks exist", () => {
    const result = sortCommandsByBookmarkStatus(mockCommands, []);
    expect(result).toEqual(mockCommands);
    // Ensure it's a new array, not the original
    expect(result).not.toBe(mockCommands);
  });

  it("should put bookmarked commands first", () => {
    const bookmarkedCommands = ["command3", "command1"];
    const result = sortCommandsByBookmarkStatus(
      mockCommands,
      bookmarkedCommands,
    );

    expect(result[0].name).toBe("command1");
    expect(result[1].name).toBe("command3");
  });
});
