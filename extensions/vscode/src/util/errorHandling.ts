import * as vscode from "vscode";

function supportSpecialHandling(error: any): boolean {
  let message: string | undefined = error.message;
  return message !== undefined && message.toLowerCase().includes("ollama");
}

/**
 * @param error Handles common LLM errors. Currently only handles Ollama-related errors.
 * @returns true if error is handled, false otherwise
 */
export function handleLLMError(error: any): boolean {
  if (!supportSpecialHandling(error)) {
    return false;
  }
  let message: string = error.message;
  let options: string[] | undefined;
  let modelName = undefined;
  if (message.includes("Ollama may not be installed")) {
    options = ["Download Ollama"];
  } else if (message.includes("Ollama may not be running")) {
    options = ["Start Ollama"]; // We want "Start" to be the only choice
  } else if (message.includes("ollama run") && error.llm) {
    //extract model name from error message matching the pattern "ollama run <model-name>"
    modelName = message.match(/`ollama run (.*)`/)?.[1];
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
    } else if (val === "Install Model" && error.llm) {
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
