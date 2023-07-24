import { RangeInFile, SerializedDebugContext } from "../client";
import * as fs from "fs";
const os = require("os");

function charIsEscapedAtIndex(index: number, str: string): boolean {
  if (index === 0) return false;
  if (str[index - 1] !== "\\") return false;
  return !charIsEscapedAtIndex(index - 1, str);
}

export function convertSingleToDoubleQuoteJSON(json: string): string {
  const singleQuote = "'";
  const doubleQuote = '"';
  const isQuote = (char: string) =>
    char === doubleQuote || char === singleQuote;

  let newJson = "";
  let insideString = false;
  let enclosingQuoteType = doubleQuote;
  for (let i = 0; i < json.length; i++) {
    if (insideString) {
      if (json[i] === enclosingQuoteType && !charIsEscapedAtIndex(i, json)) {
        // Close string with a double quote
        insideString = false;
        newJson += doubleQuote;
      } else if (json[i] === singleQuote) {
        if (charIsEscapedAtIndex(i, json)) {
          // Unescape single quote
          newJson = newJson.slice(0, -1);
        }
        newJson += singleQuote;
      } else if (json[i] === doubleQuote) {
        if (!charIsEscapedAtIndex(i, json)) {
          // Escape double quote
          newJson += "\\";
        }
        newJson += doubleQuote;
      } else {
        newJson += json[i];
      }
    } else {
      if (isQuote(json[i])) {
        insideString = true;
        enclosingQuoteType = json[i];
        newJson += doubleQuote;
      } else {
        newJson += json[i];
      }
    }
  }

  return newJson;
}

export async function readRangeInFile(
  rangeInFile: RangeInFile
): Promise<string> {
  const range = rangeInFile.range;
  return new Promise((resolve, reject) => {
    fs.readFile(rangeInFile.filepath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        let lines = data.toString().split("\n");
        if (range.start.line === range.end.line) {
          resolve(
            lines[rangeInFile.range.start.line].slice(
              rangeInFile.range.start.character,
              rangeInFile.range.end.character
            )
          );
        } else {
          let firstLine = lines[range.start.line].slice(range.start.character);
          let lastLine = lines[range.end.line].slice(0, range.end.character);
          let middleLines = lines.slice(range.start.line + 1, range.end.line);
          resolve([firstLine, ...middleLines, lastLine].join("\n"));
        }
      }
    });
  });
}

export function codeSelectionsToVirtualFileSystem(
  codeSelections: RangeInFile[]
): {
  [filepath: string]: string;
} {
  let virtualFileSystem: { [filepath: string]: string } = {};
  for (let cs of codeSelections) {
    if (!cs.filepath) continue;
    if (cs.filepath in virtualFileSystem) continue;
    let content = fs.readFileSync(cs.filepath, "utf8");
    virtualFileSystem[cs.filepath] = content;
  }
  return virtualFileSystem;
}

export function addFileSystemToDebugContext(
  ctx: SerializedDebugContext
): SerializedDebugContext {
  ctx.filesystem = codeSelectionsToVirtualFileSystem(ctx.rangesInFiles);
  return ctx;
}

export function debounced(delay: number, fn: Function) {
  let timerId: NodeJS.Timeout | null;
  return function (...args: any[]) {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delay);
  };
}

type Platform = "mac" | "linux" | "windows" | "unknown";

function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === "darwin") {
    return "mac";
  } else if (platform === "linux") {
    return "linux";
  } else if (platform === "win32") {
    return "windows";
  } else {
    return "unknown";
  }
}

export function getMetaKeyLabel() {
  const platform = getPlatform();
  switch (platform) {
    case "mac":
      return "⌘";
    case "linux":
    case "windows":
      return "^";
    default:
      return "⌘";
  }
}
