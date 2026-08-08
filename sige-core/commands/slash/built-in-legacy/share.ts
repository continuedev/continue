import { fileURLToPath } from "node:url";
import path from "path";

import { SlashCommand } from "../../../index.js";
import { shareSession } from "../../../util/historyUtils.js";

const ShareSlashCommand: SlashCommand = {
  name: "share",
  description: "Export the current chat session to markdown",
  run: async function* ({ ide, history, params }) {
    const fileUrl = await shareSession(ide, history, params?.outputDir);
    const filePath = fileURLToPath(fileUrl);
    // output path is the parent directory of the filePath
    const outPath = path.dirname(filePath);
    yield `The session transcript has been saved to a markdown file at \`${outPath}\`.`;
  },
};

export default ShareSlashCommand;
