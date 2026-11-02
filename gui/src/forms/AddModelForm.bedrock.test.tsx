import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockIdeMessenger } from "../context/MockIdeMessenger";
import { renderWithProviders } from "../util/test/render";
import { AddModelForm } from "./AddModelForm";

async function openBedrock(user: any) {
  // The provider picker is a headless listbox whose button shows the current provider.
  await user.click(await screen.findByRole("button", { name: /OpenAI/ }));
  await user.click(await screen.findByText("Amazon Bedrock"));
}

describe("AddModelForm - Amazon Bedrock", () => {
  it("switches fields with the auth method, discovers models and saves the pick", async () => {
    const messenger = new MockIdeMessenger();
    const post = vi.spyOn(messenger, "post");
    messenger.responseHandlers["bedrock/listModels"] = async () => ({
      ok: true,
      models: [
        {
          id: "amazon.nova-pro-v1:0",
          name: "Nova Pro",
          provider: "Amazon",
          kind: "on-demand",
        },
      ],
    });

    const { user } = await renderWithProviders(
      <AddModelForm onDone={vi.fn()} />,
      { mockIdeMessenger: messenger },
    );
    await openBedrock(user);

    // Default flow: API key
    const connect = screen.getByRole("button", { name: "Connect" });
    expect(screen.getByLabelText("Bedrock API key")).toBeTruthy();
    expect(screen.queryByLabelText("AWS profile name")).toBeNull();
    expect((connect as HTMLButtonElement).disabled).toBe(true);

    // Switch to profile / SSO
    await user.selectOptions(
      screen.getByLabelText("Authentication"),
      "profile",
    );
    expect(screen.queryByLabelText("Bedrock API key")).toBeNull();
    await user.type(screen.getByLabelText("AWS profile name"), "work");
    await user.selectOptions(screen.getByLabelText("AWS region"), "eu-west-1");
    await waitFor(() =>
      expect((connect as HTMLButtonElement).disabled).toBe(false),
    );

    // Discover models: the Model picker is repopulated from the live list
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText(/Showing 1 model available/)).toBeTruthy();

    await user.click(connect);
    const call = post.mock.calls.find(([type]) => type === "config/addModel");
    expect(call).toBeTruthy();
    const model = (call![1] as any).model;
    expect(model).toMatchObject({
      provider: "bedrock",
      model: "amazon.nova-pro-v1:0",
      title: "Amazon Nova Pro (Bedrock)",
      profile: "work",
      region: "eu-west-1",
      crossRegionInference: "auto",
    });
    expect(model).not.toHaveProperty("apiKey");
    expect(model).not.toHaveProperty("authMode");
  });

  it("offers Mantle-only models in the same list and saves them with the Mantle provider", async () => {
    const messenger = new MockIdeMessenger();
    const post = vi.spyOn(messenger, "post");
    const listCalls: any[] = [];
    messenger.responseHandlers["bedrock/listModels"] = async (data: any) => {
      listCalls.push(data);
      return data.endpoint === "mantle"
        ? {
            ok: true,
            models: [
              {
                id: "openai.gpt-daybreak-blue-5.6-sol",
                name: "GPT Daybreak Blue 5.6 Sol",
                provider: "OpenAI",
                kind: "on-demand",
              },
            ],
          }
        : {
            ok: true,
            models: [
              {
                id: "amazon.nova-pro-v1:0",
                name: "Nova Pro",
                provider: "Amazon",
                kind: "on-demand",
              },
            ],
          };
    };

    const { user } = await renderWithProviders(
      <AddModelForm onDone={vi.fn()} />,
      { mockIdeMessenger: messenger },
    );
    await openBedrock(user);

    await user.type(screen.getByLabelText("Bedrock API key"), "key-123");
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(
      await screen.findByText(
        /2 models available in us-east-1 \(1 only on Mantle\)/,
      ),
    ).toBeTruthy();
    expect(listCalls.map((c) => c.endpoint)).toEqual(
      expect.arrayContaining([undefined, "mantle"]),
    );

    // The Mantle-only model sits in the same Model list, labelled as Mantle.
    await user.click(screen.getByRole("button", { name: /Amazon Nova Pro/ }));
    await user.click(
      await screen.findByText("GPT Daybreak Blue 5.6 Sol · Mantle"),
    );

    await user.click(screen.getByRole("button", { name: "Connect" }));
    const call = post.mock.calls.find(([type]) => type === "config/addModel");
    expect(call).toBeTruthy();
    const model = (call![1] as any).model;
    expect(model).toMatchObject({
      provider: "bedrock-mantle",
      model: "openai.gpt-daybreak-blue-5.6-sol",
      title: "GPT Daybreak Blue 5.6 Sol (Bedrock Mantle)",
      apiKey: "key-123",
      region: "us-east-1",
    });
    expect(model).not.toHaveProperty("crossRegionInference");
  });
});
