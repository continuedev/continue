import { IDE, ILLM, SlashCommand } from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";

interface GenerateCommitMessageParams {
  ide: IDE;
  llm: ILLM;
  includeUnstaged?: boolean;
  diff?: string[];
  signal?: AbortSignal;
}

export async function* generateCommitMessage({
  ide,
  llm,
  includeUnstaged,
  diff,
  signal,
}: GenerateCommitMessageParams): AsyncGenerator<string> {
  if (!diff) {
    diff = await ide.getDiff(includeUnstaged ?? false);
  }

  if (diff.length === 0) {
    yield "No changes detected. Make sure you are in a git repository with current changes.";
    return;
  }

  const prompt = `${diff.join("\n")}\n\nGenerate a commit message for the above set of changes. First, give a single sentence, no more than 80 characters. Then, after 2 line breaks, give a list of no more than 5 short bullet points, each no more than 40 characters. Output nothing except for the commit message, and don't surround it in quotes.`;
  for await (const chunk of llm.streamChat(
    [{ role: "user", content: prompt }],
    signal ?? new AbortController().signal,
  )) {
    yield renderChatMessage(chunk);
  }
}

const CommitMessageCommand: SlashCommand = {
  name: "commit",
  description: "Generate a commit message for current changes",
  run: ({ ide, llm, params }) =>
    generateCommitMessage({
      ide,
      llm,
      includeUnstaged:
        typeof params?.includeUnstaged === "boolean"
          ? params.includeUnstaged
          : undefined,
    }),
};

export default CommitMessageCommand;
