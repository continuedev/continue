import { ConfigHandler } from "core/config/ConfigHandler";
import { DataLogger } from "core/data/log";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import {
  FromCoreProtocol,
  FromWebviewProtocol,
  ToCoreProtocol,
} from "core/protocol";
import { ToWebviewFromCoreProtocol } from "core/protocol/coreWebview";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import {
  CORE_TO_WEBVIEW_PASS_THROUGH,
  WEBVIEW_TO_CORE_PASS_THROUGH,
} from "core/protocol/passThrough";
import { stripImages } from "core/util/messageContent";
import { normalizeRepoUrl } from "core/util/repoUrl";
import {
  sanitizeShellArgument,
  validateGitHubRepoUrl,
} from "core/util/sanitization";
import * as vscode from "vscode";

import { ApplyManager } from "../apply";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { addCurrentSelectionToEdit } from "../quickEdit/AddCurrentSelection";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { handleLLMError } from "../util/errorHandling";
import { showTutorial } from "../util/tutorial";
import { getExtensionUri } from "../util/vscode";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { encodeFullSlug } from "../../../../packages/config-yaml/dist";
import { VsCodeExtension } from "./VsCodeExtension";

type ToIdeOrWebviewFromCoreProtocol = ToIdeFromCoreProtocol &
  ToWebviewFromCoreProtocol;

/**
 * A shared messenger class between Core and Webview
 * so we don't have to rewrite some of the handlers
 */
export class VsCodeMessenger {
  onWebview<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    void this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeOrWebviewFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeOrWebviewFromCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeOrWebviewFromCoreProtocol[T][1]>
      | ToIdeOrWebviewFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: VsCodeIde,
    private readonly verticalDiffManagerPromise: Promise<VerticalDiffManager>,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly workOsAuthProvider: WorkOsAuthProvider,
    private readonly editDecorationManager: EditDecorationManager,
    private readonly context: vscode.ExtensionContext,
    private readonly vsCodeExtension: VsCodeExtension,
  ) {
    /** WEBVIEW ONLY LISTENERS **/
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });

    this.onWebview("vscode/openMoveRightMarkdown", (msg) => {
      vscode.commands.executeCommand(
        "markdown.showPreview",
        vscode.Uri.joinPath(
          getExtensionUri(),
          "media",
          "move-chat-panel-right.md",
        ),
      );
    });

    this.onWebview("toggleDevTools", (msg) => {
      vscode.commands.executeCommand("continue.viewLogs");
    });

    this.onWebview("reloadWindow", (msg) => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", (msg) => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.onWebview("toggleFullScreen", (msg) => {
      vscode.commands.executeCommand("continue.openInNewWindow");
    });

    this.onWebview("acceptDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "continue.acceptDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("rejectDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "continue.rejectDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("applyToFile", async ({ data }) => {
      const [verticalDiffManager, configHandler] = await Promise.all([
        verticalDiffManagerPromise,
        configHandlerPromise,
      ]);

      const applyManager = new ApplyManager(
        this.ide,
        webviewProtocol,
        verticalDiffManager,
        configHandler,
      );

      await applyManager.applyToFile(data);
    });

    this.onWebview("showTutorial", async (msg) => {
      await showTutorial(this.ide);
    });

    this.onWebview(
      "overwriteFile",
      async ({ data: { prevFileContent, filepath } }) => {
        if (prevFileContent === null) {
          // TODO: Delete the file
          return;
        }

        await this.ide.openFile(filepath);

        // Get active text editor
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          vscode.window.showErrorMessage("No active editor to apply edits to");
          return;
        }

        editor.edit((builder) =>
          builder.replace(
            new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length),
            ),
            prevFileContent,
          ),
        );
      },
    );

    this.onWebview("insertAtCursor", async (msg) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.selection) {
        return;
      }

      editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });
    this.onWebview("edit/addCurrentSelection", async (msg) => {
      const verticalDiffManager = await this.verticalDiffManagerPromise;
      await addCurrentSelectionToEdit({
        args: undefined,
        editDecorationManager,
        webviewProtocol: this.webviewProtocol,
        verticalDiffManager,
      });
    });
    this.onWebview("edit/sendPrompt", async (msg) => {
      const prompt = msg.data.prompt;
      const { start, end } = msg.data.range.range;
      const verticalDiffManager = await verticalDiffManagerPromise;

      const configHandler = await configHandlerPromise;
      const { config } = await configHandler.loadConfig();

      if (!config) {
        throw new Error("Edit: Failed to load config");
      }

      const model =
        config?.selectedModelByRole.edit ?? config?.selectedModelByRole.chat;

      if (!model) {
        throw new Error("No Edit or Chat model selected");
      }

      const fileAfterEdit = await verticalDiffManager.streamEdit({
        input: stripImages(prompt),
        llm: model,
        streamId: EDIT_MODE_STREAM_ID,
        range: new vscode.Range(
          new vscode.Position(start.line, start.character),
          new vscode.Position(end.line, end.character),
        ),
        rulesToInclude: config.rules,
        isApply: false,
      });

      // Log dev data
      await DataLogger.getInstance().logDevData({
        name: "editInteraction",
        data: {
          prompt: stripImages(prompt),
          completion: fileAfterEdit ?? "",
          modelProvider: model.underlyingProviderName,
          modelName: model.title ?? "",
          modelTitle: model.title ?? "",
          filepath: msg.data.range.filepath,
        },
      });

      return fileAfterEdit;
    });

    this.onWebview("edit/clearDecorations", async (msg) => {
      editDecorationManager.clear();
    });

    this.onWebview("session/share", async (msg) => {
      await vscode.commands.executeCommand(
        "continue.shareSession",
        msg.data.sessionId,
      );
    });

    this.onWebview("createBackgroundAgent", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { content, contextItems, selectedCode, organizationId } = msg.data;

      // Convert resolved content to plain text prompt
      const prompt = stripImages(content);

      if (!prompt || prompt.trim().length === 0) {
        vscode.window.showErrorMessage(
          "Please enter a prompt to create a background agent",
        );
        return;
      }

      // Get workspace information
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      if (workspaceDirs.length === 0) {
        vscode.window.showErrorMessage(
          "No workspace folder found. Please open a workspace to create a background agent.",
        );
        return;
      }

      const workspaceDir = workspaceDirs[0];
      let repoUrl = "";
      let branch = "";

      try {
        // Get repo name/URL
        const repoName = await this.ide.getRepoName(workspaceDir);
        if (repoName) {
          // Normalize the URL first to get canonical form
          const normalized = normalizeRepoUrl(repoName);

          // Validate the normalized URL to prevent injection attacks
          // This ensures we validate what we'll actually use, not just the input
          if (!validateGitHubRepoUrl(normalized)) {
            vscode.window.showErrorMessage(
              "Invalid repository format. Please ensure you're using a valid GitHub repository.",
            );
            return;
          }

          repoUrl = normalized;
        }

        // Get current branch
        const branchInfo = await this.ide.getBranch(workspaceDir);
        if (branchInfo) {
          branch = branchInfo;
        }
      } catch (e) {
        console.error("Error getting repo info:", e);
      }

      if (!repoUrl) {
        vscode.window.showErrorMessage(
          "Unable to determine repository URL. Make sure you're in a git repository.",
        );
        return;
      }

      // Generate a name from the prompt (first 50 chars, cleaned up)
      let name = prompt.substring(0, 50).replace(/\n/g, " ").trim();
      if (prompt.length > 50) {
        name += "...";
      }
      // Fallback to a generic name if prompt is too short
      if (name.length < 3) {
        const repoName = await this.ide.getRepoName(workspaceDir);
        name = `Agent for ${repoName || "repository"}`;
      }

      // Get the current agent configuration from the selected profile
      let agent: string | undefined;
      try {
        const currentProfile = configHandler.currentProfile;
        if (
          currentProfile &&
          currentProfile.profileDescription.profileType !== "local"
        ) {
          // Encode the full slug to pass as the agent parameter
          agent = encodeFullSlug(currentProfile.profileDescription.fullSlug);
        }
      } catch (e) {
        console.error("Error getting agent configuration from profile:", e);
        // Continue without agent config - will use default
      }

      // Create the background agent
      try {
        console.log("Creating background agent with:", {
          name,
          prompt: prompt.substring(0, 50) + "...",
          repoUrl,
          branch,
          contextItemsCount: contextItems?.length || 0,
          selectedCodeCount: selectedCode?.length || 0,
          agent: agent || "default",
        });

        const result =
          await configHandler.controlPlaneClient.createBackgroundAgent(
            prompt,
            repoUrl,
            name,
            branch,
            organizationId,
            contextItems,
            selectedCode,
            agent,
          );

        vscode.window.showInformationMessage(
          `Background agent created successfully! Agent ID: ${result.id}`,
        );
      } catch (e) {
        console.error("Failed to create background agent:", e);
        const errorMessage =
          e instanceof Error ? e.message : "Unknown error occurred";

        // Check if this is a GitHub authorization error
        if (
          errorMessage.includes("GitHub token") ||
          errorMessage.includes("GitHub App")
        ) {
          const selection = await vscode.window.showErrorMessage(
            "Background agents need GitHub access. Please connect your GitHub account to Continue.",
            "Connect GitHub",
            "Cancel",
          );

          if (selection === "Connect GitHub") {
            await this.inProcessMessenger.externalRequest(
              "controlPlane/openUrl",
              {
                path: "settings/integrations",
                orgSlug: configHandler.currentOrg?.slug,
              },
            );
          }
        } else {
          vscode.window.showErrorMessage(
            `Failed to create background agent: ${errorMessage}`,
          );
        }
      }
    });

    this.onWebview("listBackgroundAgents", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { organizationId, limit } = msg.data;

      try {
        const result =
          await configHandler.controlPlaneClient.listBackgroundAgents(
            organizationId,
            limit,
          );
        return result;
      } catch (e) {
        console.error("Error listing background agents:", e);
        return { agents: [], totalCount: 0 };
      }
    });

    this.onWebview("openAgentLocally", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { agentSessionId } = msg.data;

      try {
        // First, fetch the agent session to get repo URL and branch
        const agentSession =
          await configHandler.controlPlaneClient.getAgentSession(
            agentSessionId,
          );
        if (!agentSession) {
          vscode.window.showErrorMessage(
            "Failed to load agent session details.",
          );
          return;
        }

        const repoUrl = agentSession.repoUrl;
        const branch = agentSession.branch;

        if (!repoUrl || !branch) {
          vscode.window.showErrorMessage(
            "Agent session is missing repository or branch information.",
          );
          return;
        }

        // Validate the repo URL from API response to prevent injection attacks
        if (!validateGitHubRepoUrl(repoUrl)) {
          vscode.window.showErrorMessage(
            "Invalid repository URL from agent session. Please contact support.",
          );
          return;
        }

        // Get workspace directories
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        if (workspaceDirs.length === 0) {
          vscode.window.showErrorMessage("No workspace folder is open.");
          return;
        }

        // Normalize and validate again to ensure the normalized form is safe
        const normalizedAgentRepo = normalizeRepoUrl(repoUrl);
        if (!validateGitHubRepoUrl(normalizedAgentRepo)) {
          vscode.window.showErrorMessage(
            "Invalid repository URL after normalization. Please contact support.",
          );
          return;
        }

        // Find the workspace that matches the agent's repo URL
        let matchingWorkspace: string | null = null;
        for (const workspaceDir of workspaceDirs) {
          const repoName = await this.ide.getRepoName(workspaceDir);
          if (repoName) {
            const normalizedRepoName = normalizeRepoUrl(repoName);

            if (normalizedRepoName === normalizedAgentRepo) {
              matchingWorkspace = workspaceDir;
              break;
            }
          }
        }

        if (!matchingWorkspace) {
          vscode.window.showErrorMessage(
            `This agent is for repository ${repoUrl}. Please open that workspace to take over the workflow.`,
          );
          return;
        }

        // Get the git repository
        const repo = await this.ide.getRepo(matchingWorkspace);
        if (!repo) {
          vscode.window.showErrorMessage("Could not access git repository.");
          return;
        }

        // Ask user what to do with uncommitted changes
        if (
          repo.state.workingTreeChanges.length > 0 ||
          repo.state.indexChanges.length > 0
        ) {
          const changeCount =
            repo.state.workingTreeChanges.length +
            repo.state.indexChanges.length;

          const choice = await vscode.window.showWarningMessage(
            `You have ${changeCount} uncommitted change(s). What would you like to do?`,
            "Stash & Continue",
            "Continue Without Stashing",
            "Cancel",
          );

          if (choice === "Cancel" || !choice) {
            return;
          }

          if (choice === "Stash & Continue") {
            try {
              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: "Stashing local changes...",
                  cancellable: false,
                },
                async () => {
                  const workspacePath =
                    vscode.Uri.parse(matchingWorkspace).fsPath;
                  // Sanitize agentSessionId to prevent command injection
                  const stashMessage = `Continue: Stashed before opening agent ${agentSessionId}`;
                  await this.ide.subprocess(
                    `git stash push -m ${sanitizeShellArgument(stashMessage)}`,
                    workspacePath,
                  );
                },
              );
              vscode.window.showInformationMessage(
                "Local changes have been stashed.",
              );
            } catch (e) {
              console.error("Failed to stash changes:", e);
              const errorMsg = e instanceof Error ? e.message : String(e);
              vscode.window.showErrorMessage(
                `Failed to stash changes: ${errorMsg}`,
              );
              return; // Stop on stash failure
            }
          }
          // If "Continue Without Stashing" was chosen, just proceed
        }

        // Check if we're already on the target branch
        try {
          const currentBranch = await this.ide.getBranch(matchingWorkspace);
          console.log(
            `Current branch: ${currentBranch}, Target branch: ${branch}`,
          );

          if (currentBranch !== branch) {
            // Try to switch to the branch using VS Code Git API
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Switching to branch ${branch}...`,
                cancellable: false,
              },
              async () => {
                try {
                  // Use VS Code Git API for checkout
                  await repo.checkout(branch);
                } catch (checkoutError: any) {
                  console.log(
                    "Checkout failed, trying to fetch first...",
                    checkoutError,
                  );
                  // If checkout fails, fetch and try again
                  await repo.fetch();
                  await repo.checkout(branch);
                }
              },
            );
            vscode.window.showInformationMessage(
              `Switched to branch ${branch}`,
            );
          } else {
            console.log("Already on target branch, skipping checkout");
          }
        } catch (e: any) {
          console.error("Failed to switch branch:", e);
          vscode.window.showErrorMessage(
            `Failed to switch to branch ${branch}: ${e.message || String(e)}`,
          );
          return;
        }

        // Fetch the agent state
        const agentState =
          await configHandler.controlPlaneClient.getAgentState(agentSessionId);

        if (!agentState) {
          vscode.window.showErrorMessage(
            "Failed to fetch agent state from API. The agent may not exist or you may not have permission.",
          );
          return;
        }

        if (!agentState.session) {
          console.error(
            "Agent state is missing session field. Full response:",
            agentState,
          );
          vscode.window.showErrorMessage(
            "Agent state returned but missing session data. This may be a backend issue.",
          );
          return;
        }

        // For MVP: Simply load the session by sending to webview
        // The webview will dispatch the newSession action with the session data
        this.webviewProtocol.send("loadAgentSession", {
          session: agentState.session,
        });

        vscode.window.showInformationMessage(
          `Successfully loaded agent workflow: ${agentState.session.title || "Untitled"}`,
        );
      } catch (e) {
        console.error("Failed to open agent locally:", e);
        vscode.window.showErrorMessage(
          `Failed to open agent locally: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      }
    });

    /** PASS THROUGH FROM WEBVIEW TO CORE AND BACK **/
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        );
      });
    });

    /** PASS THROUGH FROM CORE TO WEBVIEW AND BACK **/
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.onCore(messageType, async (msg) => {
        return this.webviewProtocol.request(messageType, msg.data);
      });
    });

    /** CORE ONLY LISTENERS **/
    // None right now

    /** BOTH CORE AND WEBVIEW **/
    this.onWebviewOrCore("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(5, 0);
          const range = new vscode.Range(start, end);

          const contents = document.getText(range);
          return contents;
        });
    });

    this.onWebviewOrCore("getIdeSettings", async (msg) => {
      return ide.getIdeSettings();
    });
    this.onWebviewOrCore("getDiff", async (msg) => {
      return ide.getDiff(msg.data.includeUnstaged);
    });
    this.onWebviewOrCore("getTerminalContents", async (msg) => {
      return ide.getTerminalContents();
    });
    this.onWebviewOrCore("getDebugLocals", async (msg) => {
      return ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebviewOrCore("getAvailableThreads", async (msg) => {
      return ide.getAvailableThreads();
    });
    this.onWebviewOrCore("getTopLevelCallStackSources", async (msg) => {
      return ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebviewOrCore("getWorkspaceDirs", async (msg) => {
      return ide.getWorkspaceDirs();
    });
    this.onWebviewOrCore("writeFile", async (msg) => {
      return ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebviewOrCore("showVirtualFile", async (msg) => {
      return ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebviewOrCore("openFile", async (msg) => {
      return ide.openFile(msg.data.path);
    });
    this.onWebviewOrCore("runCommand", async (msg) => {
      await ide.runCommand(msg.data.command);
    });
    this.onWebviewOrCore("getSearchResults", async (msg) => {
      return ide.getSearchResults(msg.data.query, msg.data.maxResults);
    });
    this.onWebviewOrCore("getFileResults", async (msg) => {
      return ide.getFileResults(msg.data.pattern, msg.data.maxResults);
    });
    this.onWebviewOrCore("subprocess", async (msg) => {
      return ide.subprocess(msg.data.command, msg.data.cwd);
    });
    this.onWebviewOrCore("getProblems", async (msg) => {
      return ide.getProblems(msg.data.filepath);
    });
    this.onWebviewOrCore("getBranch", async (msg) => {
      const { dir } = msg.data;
      return ide.getBranch(dir);
    });
    this.onWebviewOrCore("getOpenFiles", async (msg) => {
      return ide.getOpenFiles();
    });
    this.onWebviewOrCore("getCurrentFile", async () => {
      return ide.getCurrentFile();
    });
    this.onWebviewOrCore("getPinnedFiles", async (msg) => {
      return ide.getPinnedFiles();
    });
    this.onWebviewOrCore("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return ide.showLines(filepath, startLine, endLine);
    });
    this.onWebviewOrCore("showToast", (msg) => {
      this.ide.showToast(...msg.data);
    });
    this.onWebviewOrCore("getControlPlaneSessionInfo", async (msg) => {
      return getControlPlaneSessionInfo(
        msg.data.silent,
        msg.data.useOnboarding,
      );
    });
    this.onWebviewOrCore("logoutOfControlPlane", async (msg) => {
      const sessions = await this.workOsAuthProvider.getSessions();
      await Promise.all(
        sessions.map((session) => workOsAuthProvider.removeSession(session.id)),
      );
      vscode.commands.executeCommand(
        "setContext",
        "continue.isSignedInToControlPlane",
        false,
      );
    });
    this.onWebviewOrCore("saveFile", async (msg) => {
      return await ide.saveFile(msg.data.filepath);
    });
    this.onWebviewOrCore("readFile", async (msg) => {
      return await ide.readFile(msg.data.filepath);
    });
    this.onWebviewOrCore("openUrl", (msg) => {
      vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });

    this.onWebviewOrCore("fileExists", async (msg) => {
      return await ide.fileExists(msg.data.filepath);
    });

    this.onWebviewOrCore("gotoDefinition", async (msg) => {
      return await ide.gotoDefinition(msg.data.location);
    });

    this.onWebviewOrCore("getReferences", async (msg) => {
      return await ide.getReferences(msg.data.location);
    });

    this.onWebviewOrCore("getDocumentSymbols", async (msg) => {
      return await ide.getDocumentSymbols(msg.data.textDocumentIdentifier);
    });

    this.onWebviewOrCore("getFileStats", async (msg) => {
      return await ide.getFileStats(msg.data.files);
    });

    this.onWebviewOrCore("getGitRootPath", async (msg) => {
      return await ide.getGitRootPath(msg.data.dir);
    });

    this.onWebviewOrCore("listDir", async (msg) => {
      return await ide.listDir(msg.data.dir);
    });

    this.onWebviewOrCore("getRepoName", async (msg) => {
      return await ide.getRepoName(msg.data.dir);
    });

    this.onWebviewOrCore("getTags", async (msg) => {
      return await ide.getTags(msg.data);
    });

    this.onWebviewOrCore("getIdeInfo", async (msg) => {
      return await ide.getIdeInfo();
    });

    this.onWebviewOrCore("isTelemetryEnabled", async (msg) => {
      return await ide.isTelemetryEnabled();
    });

    this.onWebviewOrCore("getUniqueId", async (msg) => {
      return await ide.getUniqueId();
    });

    this.onWebviewOrCore("reportError", async (msg) => {
      await handleLLMError(msg.data);
    });
  }
}
