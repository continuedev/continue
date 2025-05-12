import { ILLM } from "core";
import { isModelInstaller } from "core/llm";
import * as vscode from "vscode";

/**
 * @param error Handles common LLM errors. Currently only handles Ollama-related errors.
 * @returns true if error is handled, false otherwise
 */
export async function handleLLMError(error: unknown): Promise<boolean> {
  if (!error || !(error instanceof Error) || !error.message) {
    return false;
  }
  if (!error.message.toLowerCase().includes("ollama")) {
    return false;
  }
  let message: string = error.message;
  let options: string[] | undefined;
  let modelName = undefined;
  if (message.includes("Ollama may not be installed")) {
    options = ["Download Ollama"];
  } else if (message.includes("Ollama may not be running")) {
    options = ["Start Ollama"]; // We want "Start" to be the only choice
  } else if (message.includes("ollama run") && "llm" in error) {
    //extract model name from error message matching the pattern "ollama run <model-name>"
    modelName = message.match(/`ollama run (.*)`/)?.[1];
    const llm = error.llm as ILLM;
    if (isModelInstaller(llm) && (await llm.isInstallingModel(modelName!))) {
      console.log(`${llm.providerName} already installing ${modelName}`);
      return false;
    }
    message = `Model "${modelName}" is not found in Ollama. You need to install it.`;
    options = [`Install Model`];
  }
  if (options === undefined) {
    console.log("Found an unhandled Ollama error: ", message);
    return false;
  }

  vscode.window.showErrorMessage(message, ...options).then((val) => {
    if (val === "Download Ollama") {
      vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai/download"));
    } else if (val === "Start Ollama") {
      vscode.commands.executeCommand("continue.startLocalOllama");
    } else if (val === "Install Model" && "llm" in error) {
      //Eventually, we might be able to support installing models for other LLM providers than Ollama
      vscode.commands.executeCommand(
        "continue.installModel",
        modelName,
        error.llm,
      );
    }
  });
  return true;
}
