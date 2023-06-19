import fetch from "node-fetch";
import * as path from "path";
import * as vscode from "vscode";
import {
  Configuration,
  DebugApi,
  RangeInFile,
  SerializedDebugContext,
  UnittestApi,
} from "./client";
import { convertSingleToDoubleQuoteJSON } from "./util/util";
import { getExtensionUri } from "./util/vscode";
import { extensionContext } from "./activation/activate";
const axios = require("axios").default;
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

function get_python_path() {
  return path.join(getExtensionUri().fsPath, "..");
}

export function get_api_url() {
  let extensionUri = getExtensionUri();
  let configFile = path.join(extensionUri.fsPath, "config/config.json");
  let config = require(configFile);

  if (config.API_URL) {
    return config.API_URL;
  }
  return "http://localhost:8000";
}
const API_URL = get_api_url();

export function getContinueServerUrl() {
  // If in debug mode, always use 8001
  if (
    extensionContext &&
    extensionContext.extensionMode === vscode.ExtensionMode.Development
  ) {
    return "http://localhost:8001";
  }
  return (
    vscode.workspace.getConfiguration("continue").get<string>("serverUrl") ||
    "http://localhost:8000"
  );
}

function build_python_command(cmd: string): string {
  return `cd ${get_python_path()} && source env/bin/activate && ${cmd}`;
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

function parseStdout(
  stdout: string,
  key: string,
  until_end: boolean = false
): string {
  const prompt = `${key}=`;
  let lines = stdout.split("\n");

  let value: string = "";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prompt)) {
      if (until_end) {
        return lines.slice(i).join("\n").substring(prompt.length);
      } else {
        return lines[i].substring(prompt.length);
      }
    }
  }
  return "";
}

export async function askQuestion(
  question: string,
  workspacePath: string
): Promise<{ answer: string; range: vscode.Range; filename: string }> {
  const command = build_python_command(
    `python3 ${path.join(
      get_python_path(),
      "ask.py"
    )} ask ${workspacePath} "${question}"`
  );

  const { stdout, stderr } = await exec(command);
  if (stderr) {
    throw new Error(stderr);
  }
  // Use the output
  const answer = parseStdout(stdout, "Answer");
  const filename = parseStdout(stdout, "Filename");
  const startLineno = parseInt(parseStdout(stdout, "Start lineno"));
  const endLineno = parseInt(parseStdout(stdout, "End lineno"));
  const range = new vscode.Range(
    new vscode.Position(startLineno, 0),
    new vscode.Position(endLineno, 0)
  );
  if (answer && filename && startLineno && endLineno) {
    return { answer, filename, range };
  } else {
    throw new Error("Error: No answer found");
  }
}

export async function apiRequest(
  endpoint: string,
  options: {
    method?: string;
    query?: { [key: string]: any };
    body?: { [key: string]: any };
  }
): Promise<any> {
  let defaults = {
    method: "GET",
    query: {},
    body: {},
  };
  options = Object.assign(defaults, options); // Second takes over first
  if (endpoint.startsWith("/")) endpoint = endpoint.substring(1);
  console.log("API request: ", options.body);

  let resp;
  try {
    resp = await axios({
      method: options.method,
      url: `${API_URL}/${endpoint}`,
      data: options.body,
      params: options.query,
      headers: {
        "x-vsc-machine-id": vscode.env.machineId,
      },
    });
  } catch (err) {
    console.log("Error: ", err);
    throw err;
  }

  return resp.data;
}

// Write a docstring for the most specific function or class at the current line in the given file
export async function writeDocstringForFunction(
  filename: string,
  position: vscode.Position
): Promise<{ lineno: number; docstring: string }> {
  let resp = await apiRequest("docstring/forline", {
    query: {
      filecontents: (
        await vscode.workspace.fs.readFile(vscode.Uri.file(filename))
      ).toString(),
      lineno: position.line.toString(),
    },
  });

  const lineno = resp.lineno;
  const docstring = resp.completion;
  if (lineno && docstring) {
    return { lineno, docstring };
  } else {
    throw new Error("Error: No docstring returned");
  }
}

export async function findSuspiciousCode(
  ctx: SerializedDebugContext
): Promise<RangeInFile[]> {
  if (!ctx.traceback) return [];
  let files = await getFileContents(
    getFilenamesFromPythonStacktrace(ctx.traceback)
  );
  let resp = await debugApi.findSusCodeEndpointDebugFindPost({
    findBody: {
      traceback: ctx.traceback,
      description: ctx.description,
      filesystem: files,
    },
  });
  let ranges = resp.response;
  if (
    ranges.length <= 1 &&
    ctx.traceback &&
    ctx.traceback.includes("AssertionError")
  ) {
    let parsed_traceback =
      await debugApi.parseTracebackEndpointDebugParseTracebackGet({
        traceback: ctx.traceback,
      });
    let last_frame = parsed_traceback.frames[0];
    if (!last_frame) return [];
    ranges = (
      await runPythonScript("build_call_graph.py", [
        last_frame.filepath,
        last_frame.lineno.toString(),
        last_frame._function,
      ])
    ).value;
  }

  return ranges;
}

export async function writeUnitTestForFunction(
  filename: string,
  position: vscode.Position
): Promise<string> {
  let resp = await apiRequest("unittest/forline", {
    method: "POST",
    body: {
      filecontents: (
        await vscode.workspace.fs.readFile(vscode.Uri.file(filename))
      ).toString(),
      lineno: position.line,
      userid: vscode.env.machineId,
    },
  });

  return resp.completion;
}

async function getFileContents(
  files: string[]
): Promise<{ [key: string]: string }> {
  let contents = await Promise.all(
    files.map(async (file: string) => {
      return (
        await vscode.workspace.fs.readFile(vscode.Uri.file(file))
      ).toString();
    })
  );
  let fileContents: { [key: string]: string } = {};
  for (let i = 0; i < files.length; i++) {
    fileContents[files[i]] = contents[i];
  }
  return fileContents;
}

function getFilenamesFromPythonStacktrace(traceback: string): string[] {
  let filenames: string[] = [];
  for (let line of traceback.split("\n")) {
    let match = line.match(/File "(.*)", line/);
    if (match) {
      filenames.push(match[1]);
    }
  }
  return filenames;
}
