import { ContextItemId, IDE } from "core";
import { ConfigHandler } from "core/config/handler";
import { addModel, addOpenAIKey, deleteModel } from "core/config/util";
import { indexDocs } from "core/indexing/docs";
import TransformersJsEmbeddingsProvider from "core/indexing/embeddings/TransformersJsEmbeddingsProvider";
import { logDevData } from "core/util/devdata";
import historyManager from "core/util/history";
import { Message } from "core/util/messenger";
import { getConfigJsonPath } from "core/util/paths";
import {
  ReverseWebviewProtocol,
  WebviewProtocol,
} from "core/web/webviewProtocol";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { showTutorial } from "./activation/activate";
import { VerticalPerLineDiffManager } from "./diff/verticalPerLine/manager";

export class VsCodeWebviewProtocol {
  listeners = new Map<keyof WebviewProtocol, ((message: Message) => any)[]>();
  abortedMessageIds: Set<string> = new Set();

  private send(messageType: string, data: any, messageId?: string): string {
    const id = messageId || uuidv4();
    this.webview?.postMessage({
      messageType,
      data,
      messageId: id,
    });
    return id;
  }

  on<T extends keyof WebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<WebviewProtocol[T][0]>,
    ) => Promise<WebviewProtocol[T][1]> | WebviewProtocol[T][1],
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }

  _webview?: vscode.Webview;
  _webviewListener?: vscode.Disposable;

  get webview(): vscode.Webview | undefined {
    return this._webview;
  }

  set webview(webView: vscode.Webview) {
    this._webview = webView;
    this._webviewListener?.dispose();

    this._webviewListener = this._webview.onDidReceiveMessage(async (msg) => {
      if (!msg.messageType || !msg.messageId) {
        throw new Error("Invalid webview protocol msg: " + JSON.stringify(msg));
      }

      const respond = (message: any) =>
        this.send(msg.messageType, message, msg.messageId);

      const handlers = this.listeners.get(msg.messageType) || [];
      for (const handler of handlers) {
        try {
          const response = await handler(msg);
          if (
            response &&
            typeof response[Symbol.asyncIterator] === "function"
          ) {
            for await (const update of response) {
              respond(update);
            }
            respond({ done: true });
          } else {
            respond(response || {});
          }
        } catch (e: any) {
          console.error(
            "Error handling webview message: " +
              JSON.stringify({ msg }, null, 2),
          );

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
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools",
                );
              } else if (selection === "Troubleshooting") {
                vscode.env.openExternal(
                  vscode.Uri.parse("https://continue.dev/docs/troubleshooting"),
                );
              }
            });
        }
      }
    });
  }

  constructor(
    private readonly ide: IDE,
    private readonly configHandler: ConfigHandler,
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
  ) {
    this.on("abort", (msg) => {
      this.abortedMessageIds.add(msg.messageId);
    });
    this.on("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });
    this.on("openConfigJson", (msg) => {
      this.ide.openFile(getConfigJsonPath());
    });
    this.on("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          let start = new vscode.Position(0, 0);
          let end = new vscode.Position(5, 0);
          let range = new vscode.Range(start, end);

          let contents = document.getText(range);
          return contents;
        });
    });
    this.on("toggleDevTools", (msg) => {
      vscode.commands.executeCommand("workbench.action.toggleDevTools");
      vscode.commands.executeCommand("continue.viewLogs");
    });
    this.on("reloadWindow", (msg) => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.on("focusEditor", (msg) => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.on("toggleFullScreen", (msg) => {
      vscode.commands.executeCommand("continue.toggleFullScreen");
    });

    // IDE
    this.on("getDiff", async (msg) => {
      return await ide.getDiff();
    });
    this.on("config/getBrowserSerialized", async (msg) => {
      return await configHandler.getSerializedConfig();
    });
    this.on("getTerminalContents", async (msg) => {
      return await ide.getTerminalContents();
    });
    this.on("listWorkspaceContents", async (msg) => {
      return await ide.listWorkspaceContents();
    });
    this.on("getWorkspaceDirs", async (msg) => {
      return await ide.getWorkspaceDirs();
    });
    this.on("listFolders", async (msg) => {
      return await ide.listFolders();
    });
    this.on("writeFile", async (msg) => {
      return await ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.on("showVirtualFile", async (msg) => {
      return await ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.on("getContinueDir", async (msg) => {
      return await ide.getContinueDir();
    });
    this.on("openFile", async (msg) => {
      return await ide.openFile(msg.data.path);
    });
    this.on("runCommand", async (msg) => {
      await ide.runCommand(msg.data.command);
    });
    this.on("getSearchResults", async (msg) => {
      return await ide.getSearchResults(msg.data.query);
    });
    this.on("subprocess", async (msg) => {
      return await ide.subprocess(msg.data.command);
    });
    // History
    this.on("history/list", (msg) => {
      return historyManager.list();
    });
    this.on("history/save", (msg) => {
      historyManager.save(msg.data);
    });
    this.on("history/delete", (msg) => {
      historyManager.delete(msg.data.id);
    });
    this.on("history/load", (msg) => {
      return historyManager.load(msg.data.id);
    });
    this.on("saveFile", async (msg) => {
      return await ide.saveFile(msg.data.filepath);
    });
    this.on("readFile", async (msg) => {
      return await ide.readFile(msg.data.filepath);
    });
    this.on("showDiff", async (msg) => {
      return await ide.showDiff(
        msg.data.filepath,
        msg.data.newContents,
        msg.data.stepIndex,
      );
    });

    this.on("getProblems", async (msg) => {
      return await ide.getProblems(msg.data.filepath);
    });
    this.on("getBranch", async (msg) => {
      const { dir } = msg.data;
      return await ide.getBranch(dir);
    });
    this.on("getOpenFiles", async (msg) => {
      return await ide.getOpenFiles();
    });
    this.on("getPinnedFiles", async (msg) => {
      return await ide.getPinnedFiles();
    });
    this.on("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return await ide.showLines(filepath, startLine, endLine);
    });
    // Other
    this.on("errorPopup", (msg) => {
      vscode.window
        .showErrorMessage(msg.data.message, "Show Logs")
        .then((selection) => {
          if (selection === "Show Logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
    });
    this.on("devdata/log", (msg) => {
      logDevData(msg.data.tableName, msg.data.data);
    });
    this.on("config/addModel", (msg) => {
      const model = msg.data.model;
      const newConfigString = addModel(model);
      this.configHandler.reloadConfig();
      this.ide.openFile(getConfigJsonPath());

      // Find the range where it was added and highlight
      let lines = newConfigString.split("\n");
      let startLine;
      let endLine;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (!startLine) {
          if (line.trim() === `"title": "${model.title}",`) {
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
        this.ide.showLines(
          getConfigJsonPath(),
          startLine,
          endLine,
          // "#fff1"
        );
      }
      vscode.window.showInformationMessage(
        "🎉 Your model has been successfully added to config.json. You can use this file to further edit its configuration.",
      );
    });
    this.on("config/deleteModel", (msg) => {
      deleteModel(msg.data.title);
      this.configHandler.reloadConfig();
    });
    this.on("config/addOpenAiKey", async (msg) => {
      addOpenAIKey(msg.data);
      this.configHandler.reloadConfig();
    });

    async function* llmStreamComplete(
      protocol: VsCodeWebviewProtocol,
      msg: Message<WebviewProtocol["llm/streamComplete"][0]>,
    ) {
      const model = await protocol.configHandler.llmFromTitle(msg.data.title);
      const gen = model.streamComplete(
        msg.data.prompt,
        msg.data.completionOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (protocol.abortedMessageIds.has(msg.messageId)) {
          protocol.abortedMessageIds.delete(msg.messageId);
          next = await gen.return({ completion: "", prompt: "" });
          break;
        }
        yield { content: next.value };
        next = await gen.next();
      }

      return { done: true, content: next.value };
    }
    this.on("llm/streamComplete", (msg) => llmStreamComplete(this, msg));

    async function* llmStreamChat(
      protocol: VsCodeWebviewProtocol,
      msg: Message<WebviewProtocol["llm/streamChat"][0]>,
    ) {
      const model = await protocol.configHandler.llmFromTitle(msg.data.title);
      const gen = model.streamChat(
        msg.data.messages,
        msg.data.completionOptions,
      );
      let next = await gen.next();
      while (!next.done) {
        if (protocol.abortedMessageIds.has(msg.messageId)) {
          protocol.abortedMessageIds.delete(msg.messageId);
          next = await gen.return({ completion: "", prompt: "" });
          break;
        }
        yield { content: next.value.content };
        next = await gen.next();
      }

      return { done: true, content: next.value };
    }
    this.on("llm/streamChat", (msg) => llmStreamChat(this, msg));
    this.on("llm/complete", async (msg) => {
      const model = await this.configHandler.llmFromTitle(msg.data.title);
      const completion = await model.complete(
        msg.data.prompt,
        msg.data.completionOptions,
      );
      return completion;
    });

    async function* runNodeJsSlashCommand(
      protocol: VsCodeWebviewProtocol,
      msg: Message<WebviewProtocol["command/run"][0]>,
    ) {
      const {
        input,
        history,
        modelTitle,
        slashCommandName,
        contextItems,
        params,
        historyIndex,
        selectedCode,
      } = msg.data;

      const config = await protocol.configHandler.loadConfig();
      const llm = await protocol.configHandler.llmFromTitle(modelTitle);
      const slashCommand = config.slashCommands?.find(
        (sc) => sc.name === slashCommandName,
      );
      if (!slashCommand) {
        throw new Error(`Unknown slash command ${slashCommandName}`);
      }

      for await (const content of slashCommand.run({
        input,
        history,
        llm,
        contextItems,
        params,
        ide,
        addContextItem: (item) => {
          protocol.request("addContextItem", {
            item,
            historyIndex,
          });
        },
        selectedCode,
        config,
      })) {
        if (content) {
          yield { content };
        }
      }
      yield { done: true, content: "" };
    }
    this.on("command/run", (msg) => runNodeJsSlashCommand(this, msg));

    this.on("context/loadSubmenuItems", async (msg) => {
      const { title } = msg.data;
      const config = await this.configHandler.loadConfig();
      const provider = config.contextProviders?.find(
        (p) => p.description.title === title,
      );
      if (!provider) {
        vscode.window.showErrorMessage(
          `Unknown provider ${title}. Existing providers: ${config.contextProviders
            ?.map((p) => p.description.title)
            .join(", ")}`,
        );
        return [];
      }

      try {
        const items = await provider.loadSubmenuItems({ ide });
        return items;
      } catch (e) {
        vscode.window.showErrorMessage(
          `Error loading submenu items from ${title}: ${e}`,
        );
        return [];
      }
    });

    this.on("context/getContextItems", async (msg) => {
      const { name, query, fullInput, selectedCode } = msg.data;
      const config = await this.configHandler.loadConfig();
      const llm = await this.configHandler.llmFromTitle();
      const provider = config.contextProviders?.find(
        (p) => p.description.title === name,
      );
      if (!provider) {
        vscode.window.showErrorMessage(
          `Unknown provider ${name}. Existing providers: ${config.contextProviders
            ?.map((p) => p.description.title)
            .join(", ")}`,
        );
        return [];
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
        return items.map((item) => ({ ...item, id }));
      } catch (e) {
        vscode.window.showErrorMessage(
          `Error getting context items from ${name}: ${e}`,
        );
        return [];
      }
    });
    this.on("context/addDocs", (msg) => {
      const { url, title } = msg.data;
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
            embeddingsProvider,
          )) {
            progress.report({
              increment: update.progress,
              message: update.desc,
            });
          }

          vscode.window.showInformationMessage(
            `🎉 Successfully indexed ${title}`,
          );

          this.request("refreshSubmenuItems", undefined);
        },
      );
    });
    this.on("applyToCurrentFile", async (msg) => {
      // Select the entire current file
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor to apply edits to");
        return;
      }
      const document = editor.document;
      const start = new vscode.Position(0, 0);
      const end = new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length,
      );
      editor.selection = new vscode.Selection(start, end);

      this.verticalDiffManager.streamEdit(
        `The following code was suggested as an edit:\n\`\`\`\n${msg.data.text}\n\`\`\`\nPlease apply it to the previous code.`,
        await this.request("getDefaultModelTitle", undefined),
      );
    });
    this.on("showTutorial", (msg) => {
      showTutorial();
    });

    this.on("openUrl", (msg) => {
      vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });
  }

  public request<T extends keyof ReverseWebviewProtocol>(
    messageType: T,
    data: ReverseWebviewProtocol[T][0],
  ): Promise<ReverseWebviewProtocol[T][1]> {
    const messageId = uuidv4();
    return new Promise((resolve) => {
      if (!this.webview) {
        resolve(undefined);
        return;
      }

      this.send(messageType, data, messageId);
      const disposable = this.webview.onDidReceiveMessage(
        (msg: Message<ReverseWebviewProtocol[T][1]>) => {
          if (msg.messageId === messageId) {
            resolve(msg.data);
            disposable?.dispose();
          }
        },
      );
    });
  }
}
