import { describe, test } from "mocha";
import * as assert from "node:assert";
import * as vscode from "vscode";
import { vscodeExtensionPromise } from "../../activation/activate";

describe("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  // test("Make sure that nothing breaks after 10 seconds", async () => {
  //   await new Promise((resolve) => setTimeout(resolve, 10_000));
  // });

  test("Get the default model from webview", async () => {
    // Current problem is that this is never resolved, because
    // this file is separate from the extension.
    const extension = await vscodeExtensionPromise;
    await vscode.commands.executeCommand("continue.continueGUIView.focus");
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const title = await (
      await extension.webviewProtocolPromise
    ).request("getDefaultModelTitle", undefined);
    console.log("Title of default model is: ", title);
    assert.strictEqual(typeof title, "string");
  });
});
