import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IdeMessengerContext, IIdeMessenger } from "../context/IdeMessenger";
import AddModelForm from "./AddModelForm";

vi.mock("../context/Auth", () => ({
  useAuth: () => ({ selectedProfile: { id: "local" } }),
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

const catalog = [
  { name: "GPT Next (gpt-next)", modelId: "gpt-next", supportsImages: true },
  { name: "Claude Next (claude-next)", modelId: "claude-next" },
  { name: "Unlisted future family", modelId: "future-family-1" },
];

function setup(aceModels: () => Promise<typeof catalog> = async () => catalog) {
  const post = vi.fn();
  const request = vi.fn(async (_type, { provider }) => ({
    status: "success",
    content: provider === "acedatacloud" ? await aceModels() : [],
  }));
  render(
    <IdeMessengerContext.Provider
      value={{ post, request } as unknown as IIdeMessenger}
    >
      <AddModelForm onDone={vi.fn()} />
    </IdeMessengerContext.Provider>,
  );
  return { post, request, user: userEvent.setup() };
}

async function chooseAce(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "OpenAI" }));
  await user.click(screen.getByRole("option", { name: "Ace Data Cloud" }));
}

describe("AddModelForm dynamic catalog", () => {
  it("loads every model before API-key entry, then saves the exact chosen ID", async () => {
    const { user, request, post } = setup();
    await chooseAce(user);
    await screen.findByText(/3 chat models from the current catalog/);
    expect(request).toHaveBeenCalledWith(
      "models/fetch",
      expect.objectContaining({ provider: "acedatacloud" }),
    );
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Select a model" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([
      "Claude Next (claude-next)",
      "GPT Next (gpt-next)",
      "Unlisted future family",
    ]);
    await user.click(
      screen.getByRole("option", { name: "Unlisted future family" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Enter your Ace Data Cloud API key"),
      { target: { value: "test-key" } },
    );
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(post).toHaveBeenCalledWith(
      "config/addModel",
      expect.objectContaining({
        model: expect.objectContaining({
          provider: "acedatacloud",
          model: "future-family-1",
        }),
      }),
    );
  });

  it("shows an empty-catalog error and allows retry without a key", async () => {
    const models = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(catalog);
    const { user } = setup(models);
    await chooseAce(user);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    await user.click(screen.getByTitle("Refresh available chat models"));
    await screen.findByText(/3 chat models from the current catalog/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("discards a late catalog response after switching providers", async () => {
    let resolve: (models: typeof catalog) => void = () => {};
    const { user } = setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await chooseAce(user);
    await screen.findByText("Loading the current model catalog…");
    await user.click(screen.getByRole("button", { name: "Ace Data Cloud" }));
    await user.click(screen.getByRole("option", { name: "OpenAI" }));
    await act(async () => resolve(catalog));
    await waitFor(() =>
      expect(
        screen.queryByText(/chat models from the current catalog/),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Unlisted future family"),
    ).not.toBeInTheDocument();
  });
});
