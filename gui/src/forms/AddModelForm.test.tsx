import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { AddModelForm } from "./AddModelForm";

afterEach(cleanup);
function setup(
  request = vi
    .fn()
    .mockResolvedValue({ status: "success", content: undefined }),
) {
  const done = vi.fn();
  render(
    <IdeMessengerContext.Provider value={{ request } as any}>
      <AddModelForm onDone={done} />
    </IdeMessengerContext.Provider>,
  );
  return { request, done };
}

describe("Gateway model setup", () => {
  it("offers only Gateway and validates namespaced model IDs", () => {
    setup();
    expect(screen.getByRole("button", { name: "Add model" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Gateway API key"), {
      target: { value: "key" },
    });
    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "gpt-4" },
    });
    expect(screen.getByRole("button", { name: "Add model" })).toBeDisabled();
    expect(screen.queryByText("Ollama")).not.toBeInTheDocument();
  });
  it("saves a Gateway model only after the user submits", async () => {
    const { request, done } = setup();
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Gateway API key"), {
      target: { value: "key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith(
      "config/addModel",
      expect.objectContaining({
        model: expect.objectContaining({
          provider: "vercel-ai-gateway",
          model: "anthropic/claude-sonnet-4.6",
          apiKey: "key",
        }),
      }),
    );
  });
  it("keeps the form open when saving fails", async () => {
    const { done } = setup(
      vi
        .fn()
        .mockResolvedValue({ status: "error", error: "Config is read-only" }),
    );
    fireEvent.change(screen.getByLabelText("Gateway API key"), {
      target: { value: "key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Config is read-only",
    );
    expect(done).not.toHaveBeenCalled();
  });
});
