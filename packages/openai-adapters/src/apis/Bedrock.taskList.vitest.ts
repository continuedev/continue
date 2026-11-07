import { describe, expect, it } from "vitest";
import { BedrockApi, TASK_LIST_BLOCK_OPEN } from "./Bedrock.js";

class TestApi extends BedrockApi {
  protected async credentialChain() {
    return { accessKeyId: "k", secretAccessKey: "s" };
  }
}

const model = "us.anthropic.claude-sonnet-4-6";
const tools = [
  {
    type: "function",
    function: { name: "read", description: "d", parameters: {} },
  },
];
const call = (id: string) => ({
  id,
  type: "function",
  function: { name: "read", arguments: "{}" },
});
const list = (text: string) => ({
  role: "user",
  content: `${TASK_LIST_BLOCK_OPEN}\n[>] 1. ${text}\n</task_list>`,
});
const step1 = [
  { role: "system", content: "be brief" },
  { role: "user", content: "fix it" },
  { role: "assistant", content: "", tool_calls: [call("a")] },
  { role: "tool", content: "out a", tool_call_id: "a" },
];
const step2 = [
  ...step1,
  { role: "assistant", content: "", tool_calls: [call("b")] },
  { role: "tool", content: "out b", tool_call_id: "b" },
];

const build = (messages: unknown[]) =>
  (
    new TestApi({
      provider: "bedrock",
      env: {},
      promptCaching: true,
    } as any) as any
  )._convertBody({ model, messages, tools });

/** (role, block) pairs before the last cache point, and all of them. */
function blocks(body: any) {
  const flat: string[] = [];
  let lastPoint = 0;
  for (const m of body.messages) {
    for (const c of m.content) {
      if (c.cachePoint) lastPoint = flat.length;
      else flat.push(JSON.stringify([m.role, c]));
    }
  }
  return { cached: flat.slice(0, lastPoint), all: flat };
}

describe("BedrockApi with the task list block at the tail", () => {
  it("puts the cache point before the block", () => {
    const last = build([...step1, list("Read")]).messages.at(-1).content;
    expect(last.at(-1).text.startsWith(TASK_LIST_BLOCK_OPEN)).toBe(true);
    expect(last.at(-2).cachePoint).toBeDefined();
  });

  it("keeps the cached prefix byte-identical when the list changes", () => {
    const a = build([...step1, list("Read")]);
    const b = build([...step2, list("Read again")]);
    expect(JSON.stringify(b.system)).toBe(JSON.stringify(a.system));
    expect(JSON.stringify(b.toolConfig)).toBe(JSON.stringify(a.toolConfig));
    const { cached } = blocks(a);
    expect(cached.length).toBeGreaterThan(0);
    expect(blocks(b).all.slice(0, cached.length)).toEqual(cached);
  });
});
