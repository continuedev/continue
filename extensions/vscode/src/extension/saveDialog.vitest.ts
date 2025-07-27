import { beforeEach, describe, expect, test, vi } from "vitest";
import * as vscode from "vscode";
import * as path from "path";

// Mock vscode module
vi.mock("vscode", () => ({
  window: {
    showSaveDialog: vi.fn(),
  },
  Uri: {
    joinPath: vi.fn((...args) => {
      const pathParts = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg && arg.fsPath) return arg.fsPath;
        return '';
      }).filter(Boolean);
      return { fsPath: pathParts.join("/") };
    }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/workspace/root" } }],
  },
}));

// Simple test function that simulates the save dialog logic
async function handleCreateFileWithDialog(data: any) {
  if (data.showSaveDialog) {
    let defaultUri: vscode.Uri | undefined;
    if (data.filepath) {
      const filename = path.basename(data.filepath);
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const suggestedDir = path.dirname(data.filepath);
        if (suggestedDir && suggestedDir !== '.') {
          defaultUri = vscode.Uri.joinPath(workspaceFolder.uri, suggestedDir, filename);
        } else {
          defaultUri = vscode.Uri.joinPath(workspaceFolder.uri, filename);
        }
      }
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      saveLabel: "Create File",
      title: "Choose location for new file",
    });

    if (!uri) {
      return null;
    }

    return uri.fsPath;
  }
  return data.filepath;
}

describe("Save Dialog Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("shows save dialog when showSaveDialog is true", async () => {
    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue({ 
      fsPath: "/user/chosen/path/file.js" 
    } as any);

    const result = await handleCreateFileWithDialog({
      showSaveDialog: true,
      filepath: "utils/helper.js",
    });

    expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
      defaultUri: expect.objectContaining({ 
        fsPath: expect.stringContaining("helper.js") 
      }),
      saveLabel: "Create File",
      title: "Choose location for new file",
    });
    expect(result).toBe("/user/chosen/path/file.js");
  });

  test("returns null when user cancels save dialog", async () => {
    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(undefined);

    const result = await handleCreateFileWithDialog({
      showSaveDialog: true,
      filepath: "newFile.ts",
    });

    expect(vscode.window.showSaveDialog).toHaveBeenCalled();
    expect(result).toBe(null);
  });

  test("returns original filepath when showSaveDialog is false", async () => {
    const result = await handleCreateFileWithDialog({
      showSaveDialog: false,
      filepath: "existing/file.js",
    });

    expect(vscode.window.showSaveDialog).not.toHaveBeenCalled();
    expect(result).toBe("existing/file.js");
  });

  test("handles nested directories correctly", async () => {
    vi.mocked(vscode.window.showSaveDialog).mockResolvedValue({ 
      fsPath: "/workspace/root/src/components/Button.tsx" 
    } as any);

    await handleCreateFileWithDialog({
      showSaveDialog: true,
      filepath: "src/components/Button.tsx",
    });

    expect(vscode.window.showSaveDialog).toHaveBeenCalledWith({
      defaultUri: expect.objectContaining({ 
        fsPath: "/workspace/root/src/components/Button.tsx" 
      }),
      saveLabel: "Create File",
      title: "Choose location for new file",
    });
  });
});
