import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";

const CommitMessageCommand: SlashCommand = {
  name: "commit",
  description: "Generate a commit message for current changes",
  run: async function* ({ ide, llm, input }) {
    const diff = await ide.getDiff();
    const prompt = `${diff}\n\nGenerate a commit message for the above set of changes. First, give a single sentence, no more than 80 characters. Then, after 2 line breaks, give a list of no more than 5 short bullet points, each no more than 40 characters. Output nothing except for the commit message, and don't surround it in quotes.`;
    for await (const chunk of llm.streamChat([
      { role: "user", content: prompt },
    ])) {
      yield stripImages(chunk.content);
    }
  },
};

export default CommitMessageCommand;
