import * as assert from "assert";
import { describe, test } from "mocha";
import * as vscode from "vscode";
import { vscodeExtensionPromise } from "../../activation/activate";

describe("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  // test("Make sure that nothing breaks after 10 seconds", async () => {
  //   await new Promise((resolve) => setTimeout(resolve, 10_000));
  // });

  test("Get the default model from webview", async () => {
    const extension = await vscodeExtensionPromise;
    const title = await extension.webviewProtocol.request(
      "getDefaultModelTitle",
      undefined,
    );
    assert.strictEqual(typeof title, "string");
  });
});
