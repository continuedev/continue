import path = require("path");
import { LanguageLibrary } from "../index.d";

const tracebackStart = "Traceback (most recent call last):";
const tracebackEnd = (buf: string): string | undefined => {
  let lines = buf
    .split("\n")
    .filter((line: string) => line.trim() !== "~~^~~")
    .filter((line: string) => line.trim() !== "");
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].startsWith("  File") &&
      i + 2 < lines.length &&
      lines[i + 2][0] !== " "
    ) {
      return lines.slice(0, i + 3).join("\n");
    }
  }
  return undefined;
};

function parseFirstStacktrace(stdout: string): string | undefined {
  let startIdx = stdout.indexOf(tracebackStart);
  if (startIdx < 0) return undefined;
  stdout = stdout.substring(startIdx);
  return tracebackEnd(stdout);
}

function lineIsFunctionDef(line: string): boolean {
  return line.startsWith("def ");
}

function parseFunctionDefForName(line: string): string {
  return line.split("def ")[1].split("(")[0];
}

function lineIsComment(line: string): boolean {
  return line.trim().startsWith("#");
}

function writeImport(
  sourcePath: string,
  pathToImport: string,
  namesToImport: string[] | undefined = undefined
): string {
  let segs = path.relative(sourcePath, pathToImport).split(path.sep);
  let importFrom = "";
  for (let seg of segs) {
    if (seg === "..") {
      importFrom = "." + importFrom;
    } else {
      if (!importFrom.endsWith(".")) {
        importFrom += ".";
      }
      importFrom += seg.split(".").slice(0, -1).join(".");
    }
  }

  return `from ${importFrom} import ${
    namesToImport ? namesToImport.join(", ") : "*"
  }`;
}

const pythonLangaugeLibrary: LanguageLibrary = {
  language: "python",
  fileExtensions: [".py"],
  parseFirstStacktrace,
  lineIsFunctionDef,
  parseFunctionDefForName,
  lineIsComment,
  writeImport,
};

export default pythonLangaugeLibrary;
