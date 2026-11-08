import { act, waitFor } from "@testing-library/react";
import type { ChatMessage } from "core";
import { addAndSelectChatModel } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";

/* A local model is asked for the room the context has left, so a large tool call is not cut off. */

const REPLY: ChatMessage[] = [{ role: "assistant", content: "Done." }];

async function maxTokensSent(model: {
  apiBase: string;
  maxTokens?: number;
}): Promise<number | undefined> {
  const { store, ideMessenger } = await renderWithProviders(<Chat />);
  await act(async () => {
    addAndSelectChatModel(store, ideMessenger, {
      title: "Model",
      model: "some-model",
      provider: "openai",
      underlyingProviderName: "openai",
      apiBase: model.apiBase,
      ...(model.maxTokens
        ? { completionOptions: { maxTokens: model.maxTokens } }
        : {}),
    });
  });
  ideMessenger.responses["context/getSymbolsForFiles"] = {};
  ideMessenger.responseHandlers["llm/compileChat"] = async ({
    messages,
  }: any) => ({
    compiledChatMessages: messages,
    didPrune: false,
    contextPercentage: 0.1,
    outputTokensAvailable: 200_000,
  });
  const streamChat = vi.spyOn(ideMessenger, "llmStreamChat");
  await sendInputWithMockedResponse(ideMessenger, "write it", REPLY);
  await waitFor(() => expect(streamChat).toHaveBeenCalled());
  return streamChat.mock.calls[0][0].completionOptions.maxTokens;
}

describe("the output limit sent with a request", () => {
  test("a local model with no configured limit gets the room left, up to the ceiling", async () => {
    expect(await maxTokensSent({ apiBase: "http://127.0.0.1:8080/v1" })).toBe(
      131_072,
    );
  });

  test("a limit configured on a local model stands", async () => {
    // Nothing is sent for this request, so core applies the model's own value
    expect(
      await maxTokensSent({
        apiBase: "http://127.0.0.1:8080/v1",
        maxTokens: 32_768,
      }),
    ).toBeUndefined();
  });

  test("a hosted model is not changed", async () => {
    expect(
      await maxTokensSent({ apiBase: "https://api.example.com/v1" }),
    ).not.toBe(131_072);
  });
});
