import { act, screen } from "@testing-library/react";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { EMPTY_CONFIG, updateConfig } from "../../../redux/slices/configSlice";
import { setupStore } from "../../../redux/store";
import { renderWithProviders } from "../../../util/test/render";
import { ModeModelsTable } from "./ModeModelsTable";

const model = (title: string) =>
  ({ title, model: title, provider: "openai" }) as any;
export const ALL_MODELS = ["Alpha", "Bravo", "Charlie"].map(model);

/** Render the table with a config, recording every `config/setModeModels` call. */
export async function setupTable(
  modeModels?: any,
  response: { saved: boolean } | "fail" = { saved: true },
) {
  const ideMessenger = new MockIdeMessenger();
  const calls: any[] = [];
  ideMessenger.responseHandlers["config/setModeModels"] = async (data) => {
    calls.push(data);
    if (response === "fail") throw new Error("boom");
    return response;
  };
  const store = setupStore({ ideMessenger });
  const view = await renderWithProviders(<ModeModelsTable />, {
    store,
    mockIdeMessenger: ideMessenger,
  });
  await act(async () => {
    store.dispatch(
      updateConfig({
        ...EMPTY_CONFIG,
        modelsByRole: { ...EMPTY_CONFIG.modelsByRole, chat: ALL_MODELS },
        ...(modeModels ? { modeModels } : {}),
      }),
    );
  });
  return { ...view, store, calls };
}

export const box = (mode: string, title: string) =>
  screen.getByLabelText(`${mode}: ${title}`) as HTMLInputElement;
export const star = (mode: string, title: string) =>
  screen.getByLabelText(`Default for ${mode}: ${title}`);
export const saveButton = () =>
  screen.getByTestId("mode-models-save") as HTMLButtonElement;
