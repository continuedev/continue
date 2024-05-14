import path from "path";
import * as fs from "fs";
import { homedir } from "os";
import { SlashCommand } from "../../index.js";
import { languageForFilepath } from "../../autocomplete/constructPrompt.js";
import { stripImages } from "../../llm/countTokens.js";

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
  msgText = msgText.replace(codeBlockFenceRegex,
    (match, metadata, filename, extension) => {
      const lang = languageForFilepath(filename);
      return `\`\`\`${extension}\n${lang.comment} ${metadata}\n`;
    },
  );
  // Appease the markdown linter
  return msgText.replace(/```\n```/g, "```\n\n```");
}

const ShareSlashCommand: SlashCommand = {
  name: "share",
  description: "Export the current chat session to markdown",
  run: async function* ({ ide, history, params }) {
    const now = new Date();

    let content = `### [Continue](https://continue.dev) session transcript\n Exported: ${now.toLocaleString()}`;

    // As currently implemented, the /share command is by definition the last
    // message in the chat history, this will omit it
    for (const msg of history.slice(0, history.length - 1)) {
      let msgText = msg.content;
      msgText = stripImages(msg.content);

      if (msg.role === "user" && msgText.search("```") > -1) {
        msgText = reformatCodeBlocks(msgText);
      }

      // format messages as blockquotes
      msgText = msgText.replace(/^/gm, "> ");

      content += `\n\n#### ${
        msg.role === "user" ? "_User_" : "_Assistant_"
      }\n\n${msgText}`;
    }

    let outputDir: string = params?.outputDir;
    if (!outputDir) {
      outputDir = await ide.getContinueDir();
    }

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
      outputDir = outputDir.replace(/^./, workspaceDirectory);
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const dtString = asBasicISOString(getOffsetDatetime(now));
    const outPath = path.join(outputDir, `${dtString}_session.md`); //TODO: more flexible naming?

    await ide.writeFile(outPath, content);
    await ide.openFile(outPath);

    yield `The session transcript has been saved to a markdown file at \`${outPath}\`.`;
  },
};

export default ShareSlashCommand;
