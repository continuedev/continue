/**
 * If we wanted to run or use another language server from our extension, this is how we would do it.
 */

import * as path from "path";
import { ExtensionContext, extensions, workspace } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
  StateChangeEvent,
  TransportKind,
} from "vscode-languageclient/node";
import { getExtensionUri } from "../util/vscode";

let client: LanguageClient;

export async function startLanguageClient(context: ExtensionContext) {
  let pythonLS = startPythonLanguageServer(context);
  pythonLS.start();
}

export async function makeRequest(method: string, param: any): Promise<any> {
  if (!client) {
    return;
  } else if (client.state === State.Starting) {
    return new Promise((resolve, reject) => {
      let stateListener = client.onDidChangeState((e: StateChangeEvent) => {
        if (e.newState === State.Running) {
          stateListener.dispose();
          resolve(client.sendRequest(method, param));
        } else if (e.newState === State.Stopped) {
          stateListener.dispose();
          reject(new Error("Language server stopped unexpectedly"));
        }
      });
    });
  } else {
    return client.sendRequest(method, param);
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function startPythonLanguageServer(context: ExtensionContext): LanguageClient {
  let extensionPath = getExtensionUri().fsPath;
  const command = `cd ${path.join(
    extensionPath,
    "scripts",
  )} && source env/bin/activate.fish && python -m pyls`;
  const serverOptions: ServerOptions = {
    command: command,
    args: ["-vv"],
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: ["python"],
    synchronize: {
      configurationSection: "pyls",
    },
  };
  return new LanguageClient(command, serverOptions, clientOptions);
}

async function startPylance(context: ExtensionContext) {
  let pylance = extensions.getExtension("ms-python.vscode-pylance");
  await pylance?.activate();
  if (!pylance) {
    return;
  }
  let { path: lsPath } = await pylance.exports.languageServerFolder();

  // The server is implemented in node
  let serverModule = context.asAbsolutePath(lsPath);
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "python" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "languageServerExample",
    "Language Server Example",
    serverOptions,
    clientOptions,
  );
  return client;
}
