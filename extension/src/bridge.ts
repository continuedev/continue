import fetch from "node-fetch";
import * as path from "path";
import * as vscode from "vscode";
import {
  Configuration,
  DebugApi,
  UnittestApi,
} from "./client";
import { convertSingleToDoubleQuoteJSON } from "./util/util";
import { getExtensionUri } from "./util/vscode";
import { extensionContext } from "./activation/activate";
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const configuration = new Configuration({
  basePath: get_api_url(),
  fetchApi: fetch as any,
  middleware: [
    {
      pre: async (context) => {
        // If there is a SerializedDebugContext in the body, add the files for the filesystem
        context.init.body;

        // Add the VS Code Machine Code Header
        context.init.headers = {
          ...context.init.headers,
          "x-vsc-machine-id": vscode.env.machineId,
        };
      },
    },
  ],
});
export const debugApi = new DebugApi(configuration);
export const unittestApi = new UnittestApi(configuration);

export function get_api_url() {
  const extensionUri = getExtensionUri();
  const configFile = path.join(extensionUri.fsPath, "config/config.json");
  const config = require(configFile);

  if (config.API_URL) {
    return config.API_URL;
  }
  return "http://localhost:65432";
}

export function getContinueServerUrl() {
  // If in debug mode, always use 8001
  if (
    extensionContext &&
    extensionContext.extensionMode === vscode.ExtensionMode.Development
  ) {
    // return "http://localhost:8001";
  }
  return (
    vscode.workspace.getConfiguration("continue").get<string>("serverUrl") ||
    "http://localhost:65432"
  );
}

function listToCmdLineArgs(list: string[]): string {
  return list.map((el) => `"$(echo "${el}")"`).join(" ");
}

export async function runPythonScript(
  scriptName: string,
  args: string[]
): Promise<any> {
  // TODO: Need to make sure that the path to poetry is in the PATH and that it is installed in the first place. Realistically also need to install npm in some cases.
  const command = `export PATH="$PATH:/opt/homebrew/bin" && cd ${path.join(
    getExtensionUri().fsPath,
    "scripts"
  )} && source env/bin/activate && python3 ${scriptName} ${listToCmdLineArgs(
    args
  )}`;

  const { stdout, stderr } = await exec(command);

  try {
    let jsonString = stdout.substring(
      stdout.indexOf("{"),
      stdout.lastIndexOf("}") + 1
    );
    jsonString = convertSingleToDoubleQuoteJSON(jsonString);
    return JSON.parse(jsonString);
  } catch (e) {
    if (stderr) {
      throw new Error(stderr);
    } else {
      throw new Error("Failed to parse JSON: " + e);
    }
  }
}
