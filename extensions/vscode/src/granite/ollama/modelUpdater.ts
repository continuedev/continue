import { LocalModelSize } from "core";
import {
  DEFAULT_MODEL_GRANITE_LARGE,
  DEFAULT_MODEL_GRANITE_SMALL,
} from "core/config/default";
import { EXTENSION_NAME } from "core/control-plane/env";
import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus } from "core/granite/commons/statuses";
import { formatSize } from "core/granite/commons/textUtils";
import {
  Disposable,
  ExtensionContext,
  ProgressLocation,
  window,
  workspace,
} from "vscode";

import { isGraniteOnboardingComplete } from "../utils/extensionUtils";

import { OllamaServer } from "./ollamaServer";

const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const USER_OPTIONS = {
  UPDATE: "Update",
  CANCEL: "Cancel",
} as const;

export class ModelUpdater implements Disposable {
  private updateInterval?: NodeJS.Timeout;
  private readonly ollamaServer: OllamaServer;
  private readonly context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.ollamaServer = new OllamaServer(context);
  }

  private shouldCheckNow(): boolean {
    //Don't check now if onboarding is not completed
    return isGraniteOnboardingComplete(this.context);
  }

  private async enableModelUpdateCheck(): Promise<void> {
    if (this.updateInterval) {
      return;
    }
    console.log("Enabling model update check");
    this.updateInterval = setInterval(
      () => this.checkModelUpdates(),
      UPDATE_INTERVAL,
    );
    if (this.shouldCheckNow()) {
      await this.checkModelUpdates();
    }
  }

  private disableModelUpdateCheck(): void {
    console.log("Disabling model update check");
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private async checkModelUpdates(): Promise<void> {
    try {
      console.log("Checking for model updates...");
      const type = workspace
        .getConfiguration(EXTENSION_NAME)
        .get<LocalModelSize>("modelSize");
      const graniteModel =
        type === "large"
          ? DEFAULT_MODEL_GRANITE_LARGE
          : DEFAULT_MODEL_GRANITE_SMALL;
      const modelsToCheck = [graniteModel.model, "nomic-embed-text:latest"];

      const modelsToUpdate = await Promise.all(
        modelsToCheck.map(async (model) => {
          try {
            const modelStatus = await this.ollamaServer.getModelStatus(
              model,
              true,
            );
            return modelStatus === ModelStatus.stale ||
              modelStatus === ModelStatus.missing //missing if the extension was updated and configured a new model id
              ? model
              : null;
          } catch (error) {
            console.error(`Failed to check status for model ${model}:`, error);
            return null;
          }
        }),
      ).then((results) =>
        results.filter((model): model is string => model !== null),
      );

      if (modelsToUpdate.length === 0) {
        console.log("No models to update");
        return;
      }

      const downloadSize = (
        await Promise.all(
          modelsToUpdate.map(async (model) => {
            const modelInfo = await this.ollamaServer.getModelInfo(model);
            return modelInfo?.size || 0;
          }),
        )
      ).reduce((total, modelSize) => total + modelSize, 0);

      console.log("Models requiring update:", modelsToUpdate);
      const userChoice = await window.showInformationMessage(
        `Granite.Code model updates available. Update requires ${formatSize(downloadSize)} download.`,
        USER_OPTIONS.UPDATE,
        USER_OPTIONS.CANCEL,
      );

      if (userChoice === USER_OPTIONS.UPDATE) {
        await this.updateModels(modelsToUpdate);
      }
    } catch (error) {
      console.error("Error during model update check:", error);
    }
  }

  private async updateModels(models: string[]): Promise<void> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Updating Granite.Code models",
        cancellable: true,
      },
      async (progress, token) => {
        const abortController = new AbortController();
        token.onCancellationRequested(() => {
          console.log("Model update cancelled by user");
          abortController.abort();
        });
        const progressWrapper = (data: ProgressData): void => {
          const completed = data.completed ?? 0;
          const total = data.total ?? 0;
          let message = data.status;

          if (total > 0) {
            const progressPercent = Math.round((completed / total) * 100);
            message = `${message} ${progressPercent}%`;
          }
          const increment = data.increment ? (data.increment / total) * 100 : 0;
          progress.report({ increment, message });
        };

        try {
          await this.ollamaServer.pullModels(
            models,
            abortController.signal,
            progressWrapper,
          );
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error("Failed to update models:", error);
            window.showErrorMessage(
              "Failed to update models. Please try again later.",
            );
          }
        }
      },
    );
  }

  async configureModelUpdateCheck(): Promise<void> {
    const checkUpdates = workspace
      .getConfiguration(EXTENSION_NAME)
      .get<boolean>("checkModelUpdates", true);

    if (checkUpdates) {
      await this.enableModelUpdateCheck();
    } else {
      this.disableModelUpdateCheck();
    }
  }

  public dispose(): void {
    this.disableModelUpdateCheck();
    this.ollamaServer.dispose();
  }
}

export async function registerModelUpdater(
  context: ExtensionContext,
): Promise<void> {
  const modelUpdater = new ModelUpdater(context);
  context.subscriptions.push(
    workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(`${EXTENSION_NAME}.checkModelUpdates`)) {
        await modelUpdater.configureModelUpdateCheck();
      }
    }),
  );
  context.subscriptions.push(modelUpdater);
  await modelUpdater.configureModelUpdateCheck();
}
