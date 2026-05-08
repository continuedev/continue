import type {
  VSCodeBridgeDialogRequest,
  VSCodeBridgeDialogResponse,
} from "core/agent/contracts/index.js";
import * as vscode from "vscode";

export async function showVSCodeBridgeDialog(
  request: VSCodeBridgeDialogRequest,
): Promise<VSCodeBridgeDialogResponse> {
  switch (request.kind) {
    case "input": {
      const value = await vscode.window.showInputBox({
        title: request.title,
        prompt: request.message,
        placeHolder: request.placeholder,
        ignoreFocusOut: true,
      });

      return {
        id: request.id,
        confirmed: value !== undefined,
        value,
      };
    }
    case "pick": {
      const options = (request.options ?? []).map((option) => ({
        label: option.title,
        detail: option.detail,
        value: option.value,
      }));

      if (request.allowMultiple) {
        const picked = await vscode.window.showQuickPick(options, {
          title: request.title,
          placeHolder: request.placeholder,
          canPickMany: true,
          ignoreFocusOut: true,
        });

        return {
          id: request.id,
          confirmed: !!picked && picked.length > 0,
          value: picked?.map((option) => option.value),
        };
      }

      const picked = await vscode.window.showQuickPick(options, {
        title: request.title,
        placeHolder: request.placeholder,
        ignoreFocusOut: true,
      });

      return {
        id: request.id,
        confirmed: picked !== undefined,
        value: picked?.value,
      };
    }
    case "warning":
    case "error":
    case "info":
    default: {
      const actions = (request.options ?? []).map((option) => option.title);
      const showMessage =
        request.kind === "warning"
          ? vscode.window.showWarningMessage
          : request.kind === "error"
            ? vscode.window.showErrorMessage
            : vscode.window.showInformationMessage;

      const selection = await showMessage(
        request.message ?? request.title,
        ...actions,
      );

      const selectedOption = request.options?.find(
        (option) => option.title === selection,
      );

      return {
        id: request.id,
        confirmed: selection !== undefined || actions.length === 0,
        value: selectedOption?.value,
      };
    }
  }
}
