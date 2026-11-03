import { describe, expect, it, vi } from "vitest";

import { LLMOptions } from "..";
import { BaseLLM } from ".";
import { LLMConfigurationStatuses } from "./constants";
import { MissingSecretError } from "../util/unresolvedSecrets";

class FakeLLM extends BaseLLM {
  static providerName = "openai";
  static defaultOptions: Partial<LLMOptions> = {
    model: "fake",
    apiBase: "https://api.test.invalid/v1/",
  };
  streamed = vi.fn();

  protected async *_streamChat() {
    this.streamed();
    yield { role: "assistant" as const, content: "ok" };
  }
  protected async *_streamComplete() {
    this.streamed();
    yield "ok";
  }
  protected async _complete() {
    this.streamed();
    return "ok";
  }
}

const unresolved = "${{ secrets.AK }}";
const make = (apiKey: string | undefined) =>
  new FakeLLM({
    model: "fake",
    title: "Fake",
    apiKey,
    // Use the provider's own code path so no network client is needed.
    useOpenAIAdapterFor: [],
  } as LLMOptions);

describe("BaseLLM with an unresolved secret", () => {
  it("reports MISSING_ENV_SECRET", () => {
    expect(make(unresolved).getConfigurationStatus()).toBe(
      LLMConfigurationStatuses.MISSING_ENV_SECRET,
    );
  });

  it("is VALID for a real key and for no key", () => {
    expect(make("sk-real").getConfigurationStatus()).toBe(
      LLMConfigurationStatuses.VALID,
    );
    expect(make(undefined).getConfigurationStatus()).toBe(
      LLMConfigurationStatuses.VALID,
    );
  });

  it("refuses to chat, without calling the provider", async () => {
    const llm = make(unresolved);
    const run = async () => {
      for await (const _ of llm.streamChat(
        [{ role: "user", content: "hi" }],
        new AbortController().signal,
      )) {
        // drain
      }
    };
    await expect(run()).rejects.toBeInstanceOf(MissingSecretError);
    expect(llm.streamed).not.toHaveBeenCalled();
  });

  it("refuses complete, streamComplete, streamFim, embed and rerank", async () => {
    const llm = make(unresolved);
    const signal = new AbortController().signal;
    await expect(llm.complete("p", signal)).rejects.toBeInstanceOf(
      MissingSecretError,
    );
    await expect(llm.streamComplete("p", signal).next()).rejects.toBeInstanceOf(
      MissingSecretError,
    );
    await expect(llm.streamFim("a", "b", signal).next()).rejects.toBeInstanceOf(
      MissingSecretError,
    );
    await expect(llm.embed(["x"])).rejects.toBeInstanceOf(MissingSecretError);
    await expect(llm.rerank("q", [])).rejects.toBeInstanceOf(
      MissingSecretError,
    );
    expect(llm.streamed).not.toHaveBeenCalled();
  });

  it("still sends a request when the key is real", async () => {
    const llm = make("sk-real");
    const out: string[] = [];
    for await (const m of llm.streamChat(
      [{ role: "user", content: "hi" }],
      new AbortController().signal,
    )) {
      out.push(String(m.content));
    }
    expect(llm.streamed).toHaveBeenCalledTimes(1);
    expect(out.join("")).toContain("ok");
  });
});
