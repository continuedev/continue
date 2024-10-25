import { describe, test } from "mocha";
import assert from "node:assert";
import path from "node:path";
import * as vscode from "vscode";
import { VsCodeIdeUtils } from "../../util/ideUtils";
import { testWorkspacePath } from "../runner/runTestOnVSCodeHost";
const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

describe("IDE Utils", () => {
  const utils = new VsCodeIdeUtils();
  const testPyPath = path.join(testWorkspacePath, "test.py");
  const testJsPath = path.join(testWorkspacePath, "test-folder", "test.js");

  test("getWorkspaceDirectories", async () => {
    const [dir] = utils.getWorkspaceDirectories();
    assert(dir.endsWith("test-workspace"));
  });

  test("fileExists", async () => {
    const exists2 = await utils.fileExists(
      path.join(testWorkspacePath, "test.py"),
    );
    assert(exists2);
  });

  test("getAbsolutePath", async () => {
    const groundTruth = path.join(testWorkspacePath, "test.py");
    assert(utils.getAbsolutePath("test.py") === groundTruth);
    assert(utils.getAbsolutePath(groundTruth) === groundTruth);
  });

  test("getOpenFiles", async () => {
    let openFiles = utils.getOpenFiles();
    assert(openFiles.length === 0);
    // await utils.openFile(testPyPath);
    let document = await vscode.workspace.openTextDocument(testPyPath);
    await vscode.window.showTextDocument(document, {
      preview: false,
    });
    openFiles = utils.getOpenFiles();
    assert(openFiles.length === 1);
    assert(openFiles[0] === testPyPath);

    document = await vscode.workspace.openTextDocument(testJsPath);
    await vscode.window.showTextDocument(document, {
      preview: false,
    });
    openFiles = utils.getOpenFiles();
    assert(openFiles.length === 2);
    assert(openFiles.includes(testPyPath));
    assert(openFiles.includes(testJsPath));
  });

  test("getUniqueId", async () => {
    const uniqueId = utils.getUniqueId();
    assert(uniqueId.length === 64);
    const regex = /^[a-z0-9]+$/;
    assert(regex.test(uniqueId));
  });

  test("readFile", async () => {
    const testPyContents = await utils.readFile(testPyPath);
    assert(testPyContents === "print('Hello World!')");
    const testJsContents = await utils.readFile(testJsPath);
    assert(testJsContents === "console.log('Hello World!')");
  });

  test.skip("getTerminalContents", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const terminal = vscode.window.createTerminal();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    terminal.show();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    terminal.sendText("echo abcdefg", true);
    const contents = await utils.getTerminalContents(1);
    console.log("TERMINAL CONTENTS: ", contents);
    assert(contents.includes("abcdefg"));
    terminal.dispose();
  });

  test("noDiff", async () => {
    const noDiff = await utils.getDiff(false);
    assert(noDiff === "");
  });

  test.skip("getBranch", async () => {
    const uri = vscode.Uri.file(testWorkspacePath);
    const branch = await utils.getBranch(uri);
    assert(typeof branch === "string");
    const { stdout } = await asyncExec("git rev-parse --abbrev-ref HEAD", {
      cwd: __dirname,
    });
    assert(branch === stdout?.trim());
  });
});
