import { SlashCommand } from ".";
import { removeQuotesAndEscapes } from "../util";

`
cmd = await sdk.models.default.complete(
    dedent(
        f"""\
       """
    )
)

cmd = remove_quotes_and_escapes(cmd.strip()).replace("\n", "").replace("\r", "")

await sdk.ide.runCommand(cmd)

yield SetStep(description=f"Generated shell command: {cmd}")

`;

const GenerateTerminalCommand: SlashCommand = {
  name: "cmd",
  description: "Generate a shell command",
  run: async function* ({ ide, llm, input }) {
    let cmd =
      await llm.complete(`The user has made a request to run a shell command. Their description of what it should do is:

"${input}"

Please write a shell command that will do what the user requested. Your output should consist of only the command itself, without any explanation or example output. Do not use any newlines. Only output the command that when inserted into the terminal will do precisely what was requested.`);
    cmd = removeQuotesAndEscapes(cmd.trim())
      .replace("\n", "")
      .replace("\r", "");
    await ide.runCommand(cmd);
    yield `Generated shell command: ${cmd}`;
  },
};

export default GenerateTerminalCommand;
