import { ContextItemId, DiffLine, FileEdit, ModelDescription } from "core";
import { indexDocs } from "core/indexing/docs";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { editConfigJson, getConfigJsonPath } from "core/util/paths";
import * as fs from "fs";
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";
import * as io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ideProtocolClient, windowId } from "./activation/activate";
import { getContinueServerUrl } from "./bridge";
import { streamEdit } from "./diff/verticalPerLine/manager";
import historyManager from "./history";
import { VsCodeIde } from "./ideProtocol";
import { configHandler, llmFromTitle } from "./loadConfig";
import { getExtensionUri, getNonce, getUniqueId } from "./util/vscode";

let sockets: { [url: string]: io.Socket | undefined } = {};

export let debugPanelWebview: vscode.Webview | undefined;

export async function webviewRequest(
  messageType: string,
  data: any = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!debugPanelWebview) {
      resolve(undefined);
    }

    const listener = debugPanelWebview?.onDidReceiveMessage((data) => {
      if (data.type === messageType) {
        resolve(data);
        listener?.dispose();
      }
    });

    debugPanelWebview?.postMessage({ type: messageType, data });

    setTimeout(() => {
      reject("Error communciating with Continue side panel: timed out");
      listener?.dispose();
    }, 500);
  });
}

export function getSidebarContent(
  panel: vscode.WebviewPanel | vscode.WebviewView,
  page: string | undefined = undefined,
  edits: FileEdit[] | undefined = undefined,
  isFullScreen: boolean = false
): string {
  if (!isFullScreen) {
    debugPanelWebview = panel.webview;
    panel.onDidDispose(() => {
      debugPanelWebview = undefined;
    });
  }

  let extensionUri = getExtensionUri();
  let scriptUri: string;
  let styleMainUri: string;
  let vscMediaUrl: string = panel.webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui"))
    .toString();

  const isProduction = true; // context?.extensionMode === vscode.ExtensionMode.Development;
  if (isProduction) {
    scriptUri = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
      .toString();
    styleMainUri = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
      .toString();
  } else {
    scriptUri = "http://localhost:5173/src/main.tsx";
    styleMainUri = "http://localhost:5173/src/main.css";
  }

  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "gui")],
    enableCommandUris: true,
    portMapping: [
      {
        webviewPort: 65433,
        extensionHostPort: 65433,
      },
    ],
  };

  const nonce = getNonce();

  async function connectWebsocket(url: string) {
    return new Promise((resolve, reject) => {
      const onMessage = (message: any) => {
        panel.webview.postMessage({
          type: "websocketForwardingMessage",
          url,
          data: message,
        });
      };
      const onOpen = () => {
        panel.webview.postMessage({
          type: "websocketForwardingOpen",
          url,
        });
        resolve(null);
      };
      const onClose = () => {
        sockets[url] = undefined;
        panel.webview.postMessage({
          type: "websocketForwardingClose",
          url,
        });
      };
      const onError = (e: any) => {
        panel.webview.postMessage({
          type: "websocketForwardingError",
          url,
          error: e,
        });
      };
      try {
        const socket = io.io(
          `${getContinueServerUrl()}?window_id=${windowId}`,
          {
            path: "/gui/socket.io",
            transports: ["websocket", "polling", "flashsocket"],
          }
        );
        sockets[url] = socket;
        resolve(null);
      } catch (e) {
        console.log("Failed to connect to GUI websocket for forwarding", e);
        reject(e);
      }
    });
  }

  panel.webview.onDidReceiveMessage(async (data) => {
    const ide = new VsCodeIde();
    const respond = (message: any) => {
      panel.webview.postMessage({
        type: data.type,
        messageId: data.messageId,
        message: message,
      });
    };
    try {
      switch (data.type) {
        case "websocketForwardingOpen": {
          let url = data.url;
          if (typeof sockets[url] === "undefined") {
            await connectWebsocket(url);
          } else {
            console.log(
              "Websocket connection requested by GUI already open at",
              url
            );
            panel.webview.postMessage({
              type: "websocketForwardingOpen",
              url,
            });
          }
          break;
        }
        case "websocketForwardingClose": {
          let url = data.url;
          let socket = sockets[url];
          if (typeof socket !== "undefined") {
            socket.close();
            sockets[url] = undefined;
          }
          break;
        }
        case "websocketForwardingMessage": {
          let url = data.url;
          let socket = sockets[url];
          if (typeof socket === "undefined") {
            await connectWebsocket(url);
          }
          socket = sockets[url];
          if (typeof socket === "undefined") {
            throw new Error("Failed to connect socket for forwarding");
          }
          socket.send(data.message);
          break;
        }
        case "showFile": {
          ideProtocolClient.openFile(data.filepath);
          break;
        }
        case "openConfigJson": {
          ideProtocolClient.openFile(getConfigJsonPath());
          break;
        }
        case "readRangeInFile": {
          vscode.workspace.openTextDocument(data.filepath).then((document) => {
            let start = new vscode.Position(0, 0);
            let end = new vscode.Position(5, 0);
            let range = new vscode.Range(start, end);

            let contents = document.getText(range);
            panel.webview.postMessage({
              type: "readRangeInFile",
              messageId: data.messageId,
              contents,
            });
          });
          break;
        }
        case "toggleDevTools": {
          vscode.commands.executeCommand("workbench.action.toggleDevTools");
          vscode.commands.executeCommand("continue.viewLogs");
          break;
        }
        case "reloadWindow": {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
          break;
        }
        case "focusEditor": {
          vscode.commands.executeCommand(
            "workbench.action.focusActiveEditorGroup"
          );
          break;
        }
        case "toggleFullScreen": {
          vscode.commands.executeCommand("continue.toggleFullScreen");
          break;
        }
        case "withProgress": {
          // This message allows withProgress to be used in the webview
          if (data.done) {
            // Will be caught in the listener created below
            break;
          }
          let title = data.title;
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title,
              cancellable: false,
            },
            async () => {
              return new Promise<void>((resolve, reject) => {
                let listener = panel.webview.onDidReceiveMessage(
                  async (data) => {
                    if (
                      data.type === "withProgress" &&
                      data.done &&
                      data.title === title
                    ) {
                      listener.dispose();
                      resolve();
                    }
                  }
                );
              });
            }
          );

          break;
        }

        // IDE
        case "getDiff": {
          respond(await ide.getDiff());
          break;
        }
        case "getSerializedConfig": {
          respond(await ide.getSerializedConfig());
          break;
        }
        case "getConfigJsUrl": {
          respond(await ide.getConfigJsUrl());
          break;
        }
        case "getTerminalContents": {
          respond(await ide.getTerminalContents());
          break;
        }
        case "listWorkspaceContents": {
          respond(await ide.listWorkspaceContents());
          break;
        }
        case "getWorkspaceDirs": {
          respond(await ide.getWorkspaceDirs());
          break;
        }
        case "listFolders": {
          respond(await ide.listFolders());
          break;
        }
        case "writeFile": {
          respond(
            await ide.writeFile(data.message.path, data.message.contents)
          );
          break;
        }
        case "showVirtualFile": {
          respond(
            await ide.showVirtualFile(data.message.name, data.message.content)
          );
          break;
        }
        case "getContinueDir": {
          respond(await ide.getContinueDir());
          break;
        }
        case "openFile": {
          respond(await ide.openFile(data.message.path));
          break;
        }
        case "runCommand": {
          respond(await ide.runCommand(data.message.command));
          break;
        }
        case "getSearchResults": {
          respond(await ide.getSearchResults(data.message.query));
          break;
        }
        case "subprocess": {
          respond(await ide.subprocess(data.message.command));
          break;
        }
        case "getFilesToEmbed": {
          let filesToEmbed = await ide.getFilesToEmbed(data.message.providerId);
          respond(filesToEmbed);
          break;
        }
        case "sendChunkForFile": {
          respond(
            await ide.sendEmbeddingForChunk(
              data.message.chunk,
              data.message.embedding,
              data.message.tags
            )
          );
          break;
        }
        case "retrieveChunks": {
          respond(
            await ide.retrieveChunks(
              data.message.text,
              data.message.n,
              data.message.directory
            )
          );
          break;
        }
        // History
        case "history": {
          respond(historyManager.list());
          break;
        }
        case "saveSession": {
          historyManager.save(data.message);
          respond({});
          break;
        }
        case "deleteSession": {
          historyManager.delete(data.message);
          respond({});
          break;
        }
        case "loadSession": {
          respond(historyManager.load(data.message));
          break;
        }
        case "saveFile": {
          respond(await ide.saveFile(data.message.filepath));
          break;
        }
        case "readFile": {
          respond(await ide.readFile(data.message.filepath));
          break;
        }
        case "showDiff": {
          respond(
            await ide.showDiff(
              data.message.filepath,
              data.message.newContents,
              data.message.stepIndex
            )
          );
          break;
        }
        case "diffLine": {
          const {
            diffLine,
            filepath,
            startLine,
            endLine,
          }: {
            diffLine: DiffLine;
            filepath: string;
            startLine: number;
            endLine: number;
          } = data.message;

          respond(
            await ide.verticalDiffUpdate(filepath, startLine, endLine, diffLine)
          );
          break;
        }
        case "getProblems": {
          respond(await ide.getProblems(data.message.filepath));
          break;
        }
        case "getBranch": {
          const { dir } = data.message;
          respond(await ide.getBranch(dir));
          break;
        }
        case "getOpenFiles": {
          respond(await ide.getOpenFiles());
          break;
        }
        case "getPinnedFiles": {
          respond(await ide.getPinnedFiles());
          break;
        }
        case "showLines": {
          const { filepath, startLine, endLine } = data.message;
          respond(await ide.showLines(filepath, startLine, endLine));
          break;
        }
        // Other
        case "errorPopup": {
          vscode.window
            .showErrorMessage(data.message, "Show Logs")
            .then((selection) => {
              if (selection === "Show Logs") {
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools"
                );
              }
            });
          break;
        }
        case "logDevData": {
          ideProtocolClient.logDevData(data.tableName, data.data);
          break;
        }
        case "addModel": {
          const model = data.model;
          const config = readFileSync(getConfigJsonPath(), "utf8");
          const configJson = JSON.parse(config);
          configJson.models.push(model);
          const newConfigString = JSON.stringify(
            configJson,
            (key, value) => {
              return value === null ? undefined : value;
            },
            2
          );
          writeFileSync(getConfigJsonPath(), newConfigString);
          ideProtocolClient.configUpdate(configJson);

          ideProtocolClient.openFile(getConfigJsonPath());

          // Find the range where it was added and highlight
          let lines = newConfigString.split("\n");
          let startLine;
          let endLine;
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (!startLine) {
              if (line.trim() === `"title": "${data.model.title}",`) {
                startLine = i - 1;
              }
            } else {
              if (line.startsWith("    }")) {
                endLine = i;
                break;
              }
            }
          }

          if (startLine && endLine) {
            ideProtocolClient.highlightCode(
              {
                filepath: getConfigJsonPath(),
                range: {
                  start: { character: 0, line: startLine },
                  end: { character: 0, line: endLine },
                },
              },
              "#fff1"
            );
          }
          vscode.window.showInformationMessage(
            "🎉 Your model has been successfully added to config.json. You can use this file to further edit its configuration."
          );
          break;
        }
        case "deleteModel": {
          const configJson = editConfigJson((config) => {
            config.models = config.models.filter(
              (m: any) => m.title !== data.title
            );
            return config;
          });
          ideProtocolClient.configUpdate(configJson);
          break;
        }
        case "addOpenAIKey": {
          const configJson = editConfigJson((config) => {
            config.models = config.models.map((m: ModelDescription) => {
              if (m.provider === "free-trial") {
                m.apiKey = data.key;
                m.provider = "openai";
              }
              return m;
            });
            return config;
          });
          ideProtocolClient.configUpdate(configJson);
          break;
        }
        case "llmStreamComplete": {
          const model = await llmFromTitle(data.message.title);
          const gen = model.streamComplete(
            data.message.prompt,
            data.message.completionOptions
          );
          let next = await gen.next();
          while (!next.done) {
            respond({ content: next.value });
            next = await gen.next();
          }

          respond({ done: true, data: next.value });
          break;
        }
        case "llmStreamChat": {
          const model = await llmFromTitle(data.message.title);
          const gen = model.streamChat(
            data.message.messages,
            data.message.completionOptions
          );
          let next = await gen.next();
          while (!next.done) {
            respond({ content: next.value.content });
            next = await gen.next();
          }

          respond({ done: true, data: next.value });
          break;
        }
        case "llmComplete": {
          const model = await llmFromTitle(data.message.title);
          const completion = await model.complete(
            data.message.prompt,
            data.message.completionOptions
          );
          respond({ content: completion });
          break;
        }
        case "runNodeJsSlashCommand": {
          const {
            input,
            history,
            modelTitle,
            slashCommandName,
            contextItems,
            params,
          } = data.message;

          const config = await configHandler.loadConfig(ide);
          const llm = await llmFromTitle(modelTitle);
          const slashCommand = config.slashCommands?.find(
            (sc) => sc.name === slashCommandName
          );
          if (!slashCommand) {
            throw new Error(`Unknown slash command ${slashCommandName}`);
          }

          for await (const update of slashCommand.run({
            input,
            history,
            llm,
            contextItems,
            params,
            ide,
            addContextItem: () => {},
          })) {
            respond({ content: update });
          }
          respond({ done: true });
          break;
        }
        case "loadSubmenuItems": {
          const { title } = data.message;
          const config = await configHandler.loadConfig(ide);
          const provider = config.contextProviders?.find(
            (p) => p.description.title === title
          );
          if (!provider) {
            vscode.window.showErrorMessage(
              `Unknown provider ${title}. Existing providers: ${config.contextProviders
                ?.map((p) => p.description.title)
                .join(", ")}`
            );
            respond({ items: [] });
            break;
          }

          try {
            const items = await provider.loadSubmenuItems({ ide });
            respond({ items });
          } catch (e) {
            vscode.window.showErrorMessage(
              `Error loading submenu items from ${title}: ${e}`
            );
            respond({ items: [] });
          }
          break;
        }
        case "getContextItems": {
          const { name, query, fullInput, selectedCode } = data.message;
          const config = await configHandler.loadConfig(ide);
          const llm = await llmFromTitle();
          const provider = config.contextProviders?.find(
            (p) => p.description.title === name
          );
          if (!provider) {
            vscode.window.showErrorMessage(
              `Unknown provider ${name}. Existing providers: ${config.contextProviders
                ?.map((p) => p.description.title)
                .join(", ")}`
            );
            respond({ items: [] });
            break;
          }

          try {
            const id: ContextItemId = {
              providerTitle: provider.description.title,
              itemId: uuidv4(),
            };
            const items = await provider.getContextItems(query, {
              llm,
              embeddingsProvider: config.embeddingsProvider,
              fullInput,
              ide,
              selectedCode,
            });
            respond({ items: items.map((item) => ({ ...item, id })) });
          } catch (e) {
            vscode.window.showErrorMessage(
              `Error getting context items from ${name}: ${e}`
            );
            respond({ items: [] });
          }
          break;
        }
        case "addDocs": {
          const { url, title } = data;
          const embeddingsProvider = new TransformersJsEmbeddingsProvider();
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Indexing ${title}`,
              cancellable: false,
            },
            async (progress) => {
              for await (const update of indexDocs(
                title,
                new URL(url),
                embeddingsProvider
              )) {
                progress.report({
                  increment: update.progress,
                  message: update.desc,
                });
              }

              vscode.window.showInformationMessage(
                `🎉 Successfully indexed ${title}`
              );

              debugPanelWebview?.postMessage({
                type: "refreshSubmenuItems",
              });
            }
          );
          break;
        }
        case "applyToCurrentFile": {
          // Select the entire current file
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage(
              "No active editor to apply edits to"
            );
            break;
          }
          const document = editor.document;
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length
          );
          editor.selection = new vscode.Selection(start, end);

          streamEdit(
            `The following code was suggested as an edit:\n\`\`\`\n${data.text}\n\`\`\`\nPlease apply it to the previous code.`
          );
          break;
        }
      }
    } catch (e: any) {
      let message = `Continue error: ${e.message}`;
      if (e.cause) {
        if (e.cause.name === "ConnectTimeoutError") {
          message = `Connection timed out. If you expect it to take a long time to connect, you can increase the timeout in config.json by setting "requestOptions": { "timeout": 10000 }. You can find the full config reference here: https://continue.dev/docs/reference/config`;
        } else if (e.cause.code === "ECONNREFUSED") {
          message = `Connection was refused. This likely means that there is no server running at the specified URL. If you are running your own server you may need to set the "apiBase" parameter in config.json. For example, you can set up an OpenAI-compatible server like here: https://continue.dev/docs/reference/Model%20Providers/openai#openai-compatible-servers--apis`;
        } else {
          message = `The request failed with "${e.cause.name}": ${e.cause.message}. If you're having trouble setting up Continue, please see the troubleshooting guide for help.`;
        }
      }

      vscode.window
        .showErrorMessage(message, "Show Logs", "Troubleshooting")
        .then((selection) => {
          if (selection === "Show Logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          } else if (selection === "Troubleshooting") {
            vscode.env.openExternal(
              vscode.Uri.parse("https://continue.dev/docs/troubleshooting")
            );
          }
        });
      respond({ done: true, data: {} });
    }
  });

  let currentTheme = undefined;
  let colorThemeName = "dark-plus";
  const tokenColorMap: any = {};
  try {
    // Pass color theme to webview for syntax highlighting
    const colorTheme = vscode.workspace
      .getConfiguration("workbench")
      .get("colorTheme");

    for (let i = vscode.extensions.all.length - 1; i >= 0; i--) {
      if (currentTheme) {
        break;
      }
      const extension = vscode.extensions.all[i];
      if (extension.packageJSON?.contributes?.themes?.length > 0) {
        for (const theme of extension.packageJSON.contributes.themes) {
          if (theme.label === colorTheme) {
            const themePath = path.join(extension.extensionPath, theme.path);
            currentTheme = fs.readFileSync(themePath).toString();
            break;
          }
        }
      }
    }

    // Strip comments from theme
    currentTheme = currentTheme
      ?.split("\n")
      .filter((line) => {
        return !line.trim().startsWith("//");
      })
      .join("\n");
  } catch (e) {
    console.log("Error adding .continueignore file icon: ", e);
  }

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>const vscode = acquireVsCodeApi();</script>
        <link href="${styleMainUri}" rel="stylesheet">

        <title>Continue</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

        <script>localStorage.setItem("ide", "vscode")</script>
        <script>window.windowId = "${windowId}"</script>
        <script>window.serverUrl = "${getContinueServerUrl()}"</script>
        <script>window.vscMachineId = "${getUniqueId()}"</script>
        <script>window.vscMediaUrl = "${vscMediaUrl}"</script>
        <script>window.ide = "vscode"</script>
        <script>window.fullColorTheme = ${currentTheme}</script>
        <script>window.colorThemeName = "${colorThemeName}"</script>
        <script>window.workspacePaths = ${JSON.stringify(
          vscode.workspace.workspaceFolders?.map(
            (folder) => folder.uri.fsPath
          ) || []
        )}</script>
        <script>window.isFullScreen = ${isFullScreen}</script>
        <script>window.proxyServerUrl = "${vscode.workspace
          .getConfiguration("continue")
          .get("proxyServerUrl")}"</script>

        ${
          edits
            ? `<script>window.edits = ${JSON.stringify(edits)}</script>`
            : ""
        }
        ${page ? `<script>window.location.pathname = "${page}"</script>` : ""}
      </body>
    </html>`;
}

export class ContinueGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "continue.continueGUIView";

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewView.webview.html = getSidebarContent(webviewView);
  }
}
