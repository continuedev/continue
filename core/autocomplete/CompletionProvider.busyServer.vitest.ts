import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const busy = vi.hoisted(() => ({ value: false }));

vi.mock("../llm/localServers.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  serverBusyElsewhere: vi.fn(async () => busy.value),
}));

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import MockLLM from "../llm/llms/Mock";
import { testConfigHandler, testIde } from "../test/fixtures";
import { localPathToUri } from "../util/pathToUri";
import { CompletionProvider } from "./CompletionProvider";
import { AutocompleteInput } from "./util/types";

// A folder of its own: the shared test workspace is reset by other files
let dir = "";

async function tabAt(llm: MockLLM) {
  const file = path.join(dir, "busy.ts");
  fs.writeFileSync(file, "function add(a: number, b: number) {\n  \n}\n");
  const fileUri = localPathToUri(file);
  const provider = new CompletionProvider(
    testConfigHandler,
    testIde,
    async () => llm,
    () => {},
    async () => [],
  );
  const input: AutocompleteInput = {
    isUntitledFile: false,
    completionId: `busy-${Math.random()}`,
    filepath: fileUri,
    pos: { line: 1, character: 2 },
    recentlyEditedRanges: [],
    recentlyVisitedRanges: [],
  };
  return provider.provideInlineCompletionItems(input, undefined, true);
}

describe("Tab on a local server busy with other work", () => {
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "busy-tab-"));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    busy.value = false;
  });

  it("does not send the request while every slot is busy", async () => {
    const llm = new MockLLM({ model: "mock" });
    llm.completion = "return a + b;";
    const streamComplete = vi.spyOn(llm, "streamComplete");
    busy.value = true;

    expect(await tabAt(llm)).toBeUndefined();
    expect(streamComplete).not.toHaveBeenCalled();
  });

  it("completes as usual once the server is free", async () => {
    const llm = new MockLLM({ model: "mock" });
    llm.completion = "return a + b;";

    const result = await tabAt(llm);
    expect(result?.completion).toBe("return a + b;");
  });
});
