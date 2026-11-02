import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { MockIdeMessenger } from "../context/MockIdeMessenger";
import { BedrockConnectionTester } from "./BedrockConnectionTester";

const models = [
  {
    id: "us.anthropic.claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (us. cross-region)",
    provider: "Anthropic",
    kind: "inference-profile" as const,
  },
  {
    id: "amazon.nova-pro-v1:0",
    name: "Nova Pro",
    provider: "Amazon",
    kind: "on-demand" as const,
  },
];

function setup(handlers: Record<string, (data: any) => any>) {
  const messenger = new MockIdeMessenger();
  Object.assign(messenger.responseHandlers, handlers);
  const onModelsLoaded = vi.fn();
  const user = userEvent.setup();
  render(
    <IdeMessengerContext.Provider value={messenger}>
      <BedrockConnectionTester
        connection={{ region: "us-east-1", apiKey: "k" }}
        model="anthropic.claude-sonnet-4-6"
        canTest
        onModelsLoaded={onModelsLoaded}
      />
    </IdeMessengerContext.Provider>,
  );
  return { user, onModelsLoaded };
}

describe("BedrockConnectionTester", () => {
  it("lists models from both endpoints and hands them to the model picker", async () => {
    const list = vi.fn(async (data: any) =>
      data.endpoint === "mantle"
        ? {
            ok: true,
            models: [
              {
                id: "openai.gpt-daybreak-blue-5.6-sol",
                name: "GPT Daybreak Blue 5.6 Sol",
                provider: "OpenAI",
                kind: "on-demand" as const,
              },
            ],
          }
        : { ok: true, models },
    );
    const { user, onModelsLoaded } = setup({ "bedrock/listModels": list });

    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(
      await screen.findByText(
        /3 models available in us-east-1 \(1 only on Mantle\)/,
      ),
    ).toBeTruthy();
    expect(list).toHaveBeenCalledWith({ region: "us-east-1", apiKey: "k" });
    expect(list).toHaveBeenCalledWith({
      region: "us-east-1",
      apiKey: "k",
      endpoint: "mantle",
    });
    const [loaded] = onModelsLoaded.mock.calls.at(-1)!;
    expect(loaded.map((m: any) => `${m.endpoint}:${m.id}`).sort()).toEqual([
      "mantle:openai.gpt-daybreak-blue-5.6-sol",
      "runtime:amazon.nova-pro-v1:0",
      "runtime:us.anthropic.claude-sonnet-4-6",
    ]);
  });

  it("still lists standard models when the Mantle endpoint fails", async () => {
    const { user, onModelsLoaded } = setup({
      "bedrock/listModels": async (data: any) =>
        data.endpoint === "mantle"
          ? { ok: false, error: "403 Forbidden\n\nmore detail" }
          : { ok: true, models },
    });
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(
      await screen.findByText(/2 models available in us-east-1/),
    ).toBeTruthy();
    const [loaded, notes] = onModelsLoaded.mock.calls.at(-1)!;
    expect(loaded).toHaveLength(2);
    expect(notes.join(" ")).toContain(
      "Mantle models unavailable: 403 Forbidden",
    );
  });

  it("clears the model list when the connection fails", async () => {
    const { user, onModelsLoaded } = setup({
      "bedrock/listModels": async () => ({ ok: false, error: "nope" }),
    });
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText("nope");
    expect(onModelsLoaded).toHaveBeenLastCalledWith(undefined, []);
  });

  it("shows the error (with its hint) when the connection fails", async () => {
    setup({
      "bedrock/listModels": async () => ({
        ok: false,
        error: "Token expired\n\nRun `aws sso login`",
      }),
    });
    await act(async () => {
      screen.getByRole("button", { name: "Test connection" }).click();
    });
    expect(await screen.findByText(/aws sso login/)).toBeTruthy();
  });

  it("sends a test message to the current model", async () => {
    const test = vi.fn(async () => ({
      ok: true,
      modelId: "us.anthropic.claude-sonnet-4-6",
      latencyMs: 420,
      reply: "ok",
    }));
    const { user } = setup({ "bedrock/testModel": test });
    await user.click(screen.getByRole("button", { name: "Send test message" }));
    await waitFor(() => expect(screen.getByText(/in 420 ms/)).toBeTruthy());
    expect(test).toHaveBeenCalledWith({
      region: "us-east-1",
      apiKey: "k",
      model: "anthropic.claude-sonnet-4-6",
    });
  });
});
