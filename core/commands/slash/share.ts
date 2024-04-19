import path from "path";
import { homedir } from "os";
import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";

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

  return isoString.replace(/[-:]/g, "").replace(/\.\d+Z/, "");
}

const ShareSlashCommand: SlashCommand = {
  name: "share",
  description: "Export the current chat session to markdown",
  run: async function* ({ ide, history, params }) {
    const now = new Date();

    let content = `This is a session transcript from [Continue](https://continue.dev) on ${now.toLocaleString()}.`;

    for (const msg of history) {
      content += `\n\n## ${
        msg.role === "user" ? "User" : "Continue"
      }\n\n${stripImages(msg.content)}`;
    }

    let outputDir: string = params?.outputDir;
    if (!outputDir) {
      outputDir = await ide.getContinueDir();
    }
    if (outputDir.startsWith("~")) {
      outputDir = outputDir.replace(/~/, homedir);
    }
    //TODO: error handling, create path if it doesn't exist?

    const workspaceDirs = await ide.getWorkspaceDirs();

    // Although the most common situation is to have one directory open in a
    // workspace it's also possible to have just a file open without an
    // associated directory or to use multi-root workspaces in which multiple
    // folders are included. We default to using the first item in the list, if
    // it exists.
    const workspaceDirectory = workspaceDirs?.[0] || "";
    if (
      outputDir.startsWith("./") ||
      outputDir.startsWith(`.\\`) ||
      outputDir === "."
    ) {
      outputDir = outputDir.replace(".", workspaceDirectory);
    }

    const dtString = asBasicISOString(getOffsetDatetime(now));
    const outPath = path.join(outputDir, `${dtString}_session.md`); //TODO: more flexible naming?

    await ide.writeFile(outPath, content);
    await ide.openFile(outPath);

    yield `The session transcript has been saved to a markdown file at \`${outPath}\`.`;
  },
};

export default ShareSlashCommand;
