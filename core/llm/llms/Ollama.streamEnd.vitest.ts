import { beforeEach, describe, expect, test, vi } from "vitest";

// _streamChat reads the body through streamResponse; feed it text pieces.
const pieces = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock("@continuedev/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@continuedev/fetch")>()),
  streamResponse: async function* () {
    for (const p of pieces.list) yield p;
  },
}));

import Ollama from "./Ollama.js";

function createOllama(): Ollama {
  // Skip the constructor, which contacts the server.
  const o = Object.create(Ollama.prototype);
  o.model = "llama3";
  o.completionOptions = {};
  o.ensureModelInfo = async () => {};
  o._getModel = () => "llama3";
  o.getEndpoint = (p: string) => new URL(p, "http://localhost:11434/");
  o.fetch = async () => ({ status: 200, ok: true });
  return o;
}

const line = (content: string, done = false) =>
  JSON.stringify({
    model: "llama3",
    created_at: "2026-11-05T00:00:00Z",
    message: { role: "assistant", content },
    done,
  });

async function run(signal = new AbortController().signal) {
  const out: string[] = [];
  for await (const m of (createOllama() as any)._streamChat(
    [{ role: "user", content: "hi" }],
    signal,
    { model: "llama3" },
  )) {
    if (typeof m.content === "string") out.push(m.content);
  }
  return out.join("");
}

describe("Ollama chat stream end", () => {
  beforeEach(() => {
    pieces.list = [];
  });

  test("a stream ending in done: true returns the whole reply", async () => {
    pieces.list = [
      line("Hel") + "\n",
      line("lo") + "\n" + line("", true) + "\n",
    ];
    await expect(run()).resolves.toBe("Hello");
  });

  test("the last line is read even without a trailing newline", async () => {
    pieces.list = [line("Hel") + "\n" + line("lo", true)];
    await expect(run()).resolves.toBe("Hello");
  });

  test("a stream with no done: true is reported as cut off", async () => {
    pieces.list = [line("Hel") + "\n"];
    await expect(run()).rejects.toThrow(
      /ended before the response was complete/,
    );
  });

  test("stopping the reply is not reported as a cut-off", async () => {
    pieces.list = [line("Hel") + "\n"];
    const c = new AbortController();
    c.abort();
    await expect(run(c.signal)).resolves.toBe("Hel");
  });

  test("an error line is still reported as before", async () => {
    pieces.list = [JSON.stringify({ error: "model not found" }) + "\n"];
    await expect(run()).rejects.toThrow(
      /Error parsing Ollama response: Error: model not found/,
    );
  });
});
