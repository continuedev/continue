import { describe, expect, it, vi } from "vitest";

import { IDE } from "../..";
import { shouldPrefilter } from ".";
import { getConfigJsonPath } from "../../util/paths";
import { HelperVars } from "../util/HelperVars";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";

describe("shouldPrefilter", () => {
  const mockLanguage: AutocompleteLanguageInfo = {
    name: "TypeScript",
    topLevelKeywords: [],
    singleLineComment: "//",
    endOfLine: [";"],
  };

  const mockIde: IDE = {
    getWorkspaceDirs: vi.fn().mockResolvedValue([]),
  } as unknown as IDE;

  function createMockHelper(filepath: string): HelperVars {
    return {
      filepath,
      pos: { line: 0, character: 0 },
      fileContents: "test content",
      fileLines: ["test content"],
      lang: mockLanguage,
      options: {},
    } as unknown as HelperVars;
  }

  it("returns true when helper.filepath matches getConfigJsonPath()", async () => {
    const helper = createMockHelper(getConfigJsonPath());
    const result = await shouldPrefilter(helper, mockIde);
    expect(result).toBe(true);
  });

  it("returns true when helper.filepath matches config.yaml path", async () => {
    const yamlPath = getConfigJsonPath().replace(/\.json$/, ".yaml");
    const helper = createMockHelper(yamlPath);
    const result = await shouldPrefilter(helper, mockIde);
    expect(result).toBe(true);
  });

  it("returns false for a normal file path", async () => {
    const helper = createMockHelper("file:///home/user/project/main.ts");
    const result = await shouldPrefilter(helper, mockIde);
    expect(result).toBe(false);
  });
});
