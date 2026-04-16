import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddModelForm } from "./AddModelForm";
import { renderWithProviders } from "../util/test/render";

const fetchProviderModelsMock = vi.hoisted(() => vi.fn());
const initializeDynamicModelsMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../pages/AddNewModel/configs/fetchProviderModels", () => ({
  fetchProviderModels: fetchProviderModelsMock,
  initializeDynamicModels: initializeDynamicModelsMock,
}));

vi.mock("../components/modelSelection/ModelSelectionListbox", () => ({
  default: ({
    selectedProvider,
    setSelectedProvider,
    topOptions = [],
    otherOptions = [],
    searchPlaceholder,
  }: any) => (
    <div data-testid={searchPlaceholder ? "provider-listbox" : "model-listbox"}>
      <div
        data-testid={searchPlaceholder ? "provider-current" : "model-current"}
      >
        {selectedProvider.title}
      </div>
      <div>
        {topOptions.map((option: any) => (
          <button
            key={option.title}
            type="button"
            onClick={() => setSelectedProvider(option)}
          >
            {option.title}
          </button>
        ))}
      </div>
      <div>
        {otherOptions.map((option: any) => (
          <div key={option.title} data-testid="model-other-option">
            {option.title}
          </div>
        ))}
      </div>
    </div>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeFetchedModel(title: string) {
  return {
    title,
    description: title,
    params: {
      title,
      model: title.toLowerCase().replace(/\s+/g, "-"),
    },
    isOpenSource: false,
    providerOptions: ["openai"],
  };
}

describe("AddModelForm dynamic fetch race", () => {
  beforeEach(() => {
    fetchProviderModelsMock.mockReset();
    initializeDynamicModelsMock.mockClear();
  });

  it("does not leak stale models from the previous provider if the earlier fetch resolves late", async () => {
    const pendingOpenAiFetch = deferred<any[]>();

    fetchProviderModelsMock.mockImplementation(
      (_messenger: unknown, provider: string) => {
        if (provider === "openai") {
          return pendingOpenAiFetch.promise;
        }
        return Promise.resolve([]);
      },
    );

    const { user } = await renderWithProviders(
      <AddModelForm onDone={vi.fn()} />,
    );

    await user.type(
      screen.getByPlaceholderText(/Enter your OpenAI API key/i),
      "sk-test-key",
    );
    await user.click(screen.getByTitle(/fetch available models/i));

    await user.click(screen.getByRole("button", { name: "Anthropic" }));
    expect(screen.getByTestId("provider-current")).toHaveTextContent(
      "Anthropic",
    );

    await act(async () => {
      pendingOpenAiFetch.resolve([makeFetchedModel("OpenAI Dynamic Model")]);
      await pendingOpenAiFetch.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("provider-current")).toHaveTextContent(
        "Anthropic",
      );
      expect(screen.getByTestId("model-listbox")).not.toHaveTextContent(
        "OpenAI Dynamic Model",
      );
    });
  });
});
