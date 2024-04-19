import path from "path";
import { homedir } from "os";
import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";

const ShareSlashCommand: SlashCommand = {
  name: "share",
  description: "Export the current chat session to markdown",
  run: async function* ({ ide, history, params }) {
    let content = `This is a session transcript from [Continue](https://continue.dev) on ${new Date().toLocaleString()}.`;

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
      outputDir = outputDir.replace(/~/, homedir);
    }

    const outPath = path.join(outputDir, `session.md`);
    await ide.writeFile(outPath, content);
    await ide.openFile(outPath);

    yield `The session transcript has been saved to a markdown file at \`${outPath}\`.`;
  },
};

export default ShareSlashCommand;
