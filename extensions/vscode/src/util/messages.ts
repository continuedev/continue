import * as vscode from "vscode";

export function showFreeTrialLoginMessage(
  message: string,
  reloadConfig: () => void,
  openOnboardingCard: () => void,
) {
  vscode.window
    .showInformationMessage(message, "Sign In", "Use API key / local model")
    .then((selection) => {
      if (selection === "Sign In") {
        vscode.authentication
          .getSession("github", [], {
            createIfNone: true,
          })
          .then(() => {
            reloadConfig();
          });
      } else if (selection === "Use API key / local model") {
        openOnboardingCard();
      }
    });
}
