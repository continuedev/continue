import * as assert from "assert";
import { describe, test } from "mocha";
import * as vscode from "vscode";

describe("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", async () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  });
});
