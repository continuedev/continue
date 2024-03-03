import * as dotenv from "dotenv";
import { ContinueSDK } from "..";
import EditSlashCommand, { getPromptParts } from "../commands/slash/edit";
import { contextItemToRangeInFileWithContents } from "../commands/util";
import FreeTrial from "../llm/llms/FreeTrial";
import Ollama from "../llm/llms/Ollama";
import { dedentAndGetCommonWhitespace } from "../util";
import FileSystemIde from "../util/filesystem";

jest.setTimeout(100_000);

dotenv.config();

const TEST_CONTEXT_ITEM = {
  name: "editme.py (1-2)",
  description: "/Users/natesesti/Desktop/continue/core/llm/test/editme.py",
  content: "def average(nums: list) -> float:\n    pass\n",
  id: {
    providerTitle: "code",
    itemId: "/Users/natesesti/Desktop/continue/core/llm/test/editme.py",
  },
  editing: true,
};

const f1 = `\
def maximum(nums: list) -> float:
    return max(nums)
`;

const f2 = `\
def total(nums: list) -> float:
    s = sum(nums)
    return s
`;

const f3 = `\
def average(nums: list) -> float:
    return sum(nums) / len(nums)
`;

const fullFile = `${f1}\n${f2}\n${f3}\n`;

const TEST_CONTEXT_ITEM2 = {
  name: "editme2.py (4-7)",
  description: "/Users/natesesti/Desktop/continue/core/llm/test/editme2.py",
  content: f2,
  id: {
    providerTitle: "code",
    itemId: "/Users/natesesti/Desktop/continue/core/llm/test/editme2.py",
  },
  editing: true,
};

describe("/edit slash command", () => {
  test.only("doesn't break", async () => {
    const command = EditSlashCommand;
    const sdk: ContinueSDK = {
      ide: new FileSystemIde(),
      // llm: new FreeTrial({ model: "gpt-3.5-turbo" }),
      llm: new Ollama({ model: "codellama-7b" }),
      addContextItem: (item: any) => {},
      history: [],
      input: "implement this function",
      contextItems: [TEST_CONTEXT_ITEM],
      selectedCode: [],
      config: {} as any,
    };

    let total = "";
    for await (const update of command.run(sdk)) {
      if (update === undefined) continue;
      total += update;
    }
    console.log(total);
  });

  test.skip("dedentAndGetCommonWhitespace", () => {
    // TODO
    let [dedented, whitespace] = dedentAndGetCommonWhitespace(
      `\
      ...
      ...
      ...
       ..
          .  .`
    );

    expect(dedented).toEqual(`\
...
...
...
 ..
    .  .`);
    expect(whitespace).toEqual("      ");

    let [dedented2, whitespace2] = dedentAndGetCommonWhitespace("");
    expect(dedented2).toEqual("");
    expect(whitespace2).toEqual("");

    let [dedented3, whitespace3] = dedentAndGetCommonWhitespace(" \n\n  ");
    expect(dedented3).toEqual(" \n\n  ");
    expect(whitespace3).toEqual("");
  });

  test.skip("getPromptParts", async () => {
    // TODO
    const { filePrefix, fileSuffix, contents, maxTokens } =
      await getPromptParts(
        contextItemToRangeInFileWithContents(TEST_CONTEXT_ITEM2),
        fullFile,
        new FreeTrial({ model: "gpt-3.5-turbo" }),
        "implement this function",
        1200
      );

    expect(filePrefix).toEqual(`${f1}`);
    expect(`${fileSuffix}\n`).toEqual(`\n${f3}`);
    expect(contents).toEqual(f2);
    expect(maxTokens).toEqual(2048);
  });
});
