import { SlashCommand } from "../..";

const CommitMessageCommand: SlashCommand = {
  name: "commit",
  description: "Generate a commit message for current changes",
  run: async function* ({ ide, llm, input }) {
    const diff = await ide.getDiff();
    const prompt = `${diff}\n\nGenerate a commit message for the above set of changes. If the changes are easily described in a single concept, then give a single sentence, no more than 80 characters. Otherwise, give a list of short bullet points, each no more than 40 characters. Output nothing except for the commit message.`;
    for await (const chunk of llm.streamChat([
      { role: "user", content: prompt },
    ])) {
      yield chunk.content;
    }
  },
};

export default CommitMessageCommand;
