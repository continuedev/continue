import { SlashCommand } from "../..";
import { streamLines } from "../../diff/util";
import { removeQuotesAndEscapes } from "../../util";

const GenerateTerminalCommand: SlashCommand = {
  name: "cmd",
  description: "Generate a shell command",
  run: async function* ({ ide, llm, input }) {
    const gen =
      llm.streamComplete(`The user has made a request to run a shell command. Their description of what it should do is:

"${input}"

Please write a shell command that will do what the user requested. Your output should consist of only the command itself, without any explanation or example output. Do not use any newlines. Only output the command that when inserted into the terminal will do precisely what was requested. Here is the command:`);

    const lines = streamLines(gen);
    let cmd = "";
    for await (const line of lines) {
      console.log(line);
      if (line.startsWith("```") && line.endsWith("```")) {
        cmd = line.split(" ").slice(1).join(" ").slice(0, -3);
        break;
      }

      if (
        line.startsWith(">") ||
        line.startsWith("``") ||
        line.startsWith("\\begin{") ||
        line.trim() === ""
      ) {
        continue;
      }

      cmd = removeQuotesAndEscapes(line.trim());
      break;
    }

    await ide.runCommand(cmd);
    yield `Generated shell command: ${cmd}`;
  },
};

export default GenerateTerminalCommand;
