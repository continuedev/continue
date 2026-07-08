import fs from "fs";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "path";

import { languageForFilepath } from "../autocomplete/constants/AutocompleteLanguageInfo.js";
import { ChatMessage, IDE } from "../index.js";
import { renderChatMessage } from "../util/messageContent.js";
import { getContinueGlobalPath } from "../util/paths.js";

// If useful elsewhere, helper funcs should move to core/util/index.ts or similar
function getOffsetDatetime(date: Date): Date {
  const offset = date.getTimezoneOffset();
  const offsetHours = Math.floor(offset / 60);
  const offsetMinutes = offset % 60;
  date.setHours(date.getHours() - offsetHours);
  date.setMinutes(date.getMinutes() - offsetMinutes);

  return date;
}

function asBasicISOString(date: Date): string {
  const isoString = date.toISOString();

  return isoString.replace(/[-:]|(\.\d+Z)/g, "");
}

function reformatCodeBlocks(msgText: string): string {
  const codeBlockFenceRegex = /```((.*?\.(\w+))\s*.*)\n/g;
  msgText = msgText.replace(
    codeBlockFenceRegex,
    (match, metadata, filename, extension) => {
      const lang = languageForFilepath(filename);
      return `\`\`\`${extension}\n${lang.singleLineComment} ${metadata}\n`;
    },
  );
  // Appease the markdown linter
  return msgText.replace(/```\n```/g, "```\n\n```");
}

export function toMarkDown(history: ChatMessage[], time?: Date): string {
  if (!time) {
    time = new Date();
  }
  let content = `### [Continue](https://continue.dev) session transcript\n Exported: ${time.toLocaleString()}`;

  for (const msg of history) {
    let msgText = renderChatMessage(msg);
    if (!msgText) {
      continue; // Skip messages without content
    }

    if (msg.role === "user" && msgText.search("```") > -1) {
      msgText = reformatCodeBlocks(msgText);
    }

    // format messages as blockquotes
    msgText = msgText.replace(/^/gm, "> ");

    content += `\n\n#### ${
      msg.role === "user" ? "_User_" : "_Assistant_"
    }\n\n${msgText}`;
  }
  return content;
}

export async function shareSession(
  ide: IDE,
  history: ChatMessage[],
  outputDir?: string,
) {
  const now = new Date();
  const content = toMarkDown(history, now);

  outputDir = outputDir ?? getContinueGlobalPath();

  if (outputDir.startsWith("~")) {
    outputDir = outputDir.replace(/^~/, homedir);
  } else if (
    outputDir.startsWith("./") ||
    outputDir.startsWith(".\\") ||
    outputDir === "."
  ) {
    const workspaceDirs = await ide.getWorkspaceDirs();
    // Although the most common situation is to have one directory open in a
    // workspace it's also possible to have just a file open without an
    // associated directory or to use multi-root workspaces in which multiple
    // folders are included. We default to using the first item in the list, if
    // it exists.
    const workspaceDirectory = workspaceDirs?.[0] || "";
    outputDir = outputDir.replace(/^./, fileURLToPath(workspaceDirectory));
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dtString = asBasicISOString(getOffsetDatetime(now));
  const outPath = path.join(outputDir, `${dtString}_session.md`); //TODO: more flexible naming?

  const fileUrl = pathToFileURL(outPath).toString(); // TODO switch from path to URI above ^
  await ide.writeFile(fileUrl, content);
  await ide.openFile(fileUrl);
  return fileUrl;
}
