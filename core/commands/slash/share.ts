import path from "path";
import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";

const ShareSlashCommand: SlashCommand = {
  name: "share",
  description: "Download and share this session",
  run: async function* ({ ide, history, params }) {
    let content = `This is a session transcript from [Continue](https://continue.dev) on ${new Date().toLocaleString()}.`;

    for (const msg of history) {
      content += `\n\n## ${
        msg.role === "user" ? "User" : "Continue"
      }\n\n${stripImages(msg.content)}`;
    }

    let outputDir = params?.outputDir;
    if (!outputDir) {
      outputDir = await ide.getContinueDir();
    }

    const outPath = path.join(outputDir, `session.md`);
    await ide.writeFile(outPath, content);
    await ide.openFile(outPath);

    yield `The session transcript has been saved to a markdown file at \`${path}\`.`;
  },
};

export default ShareSlashCommand;
