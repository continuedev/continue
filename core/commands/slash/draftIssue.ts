import { ChatMessage, SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";
import { removeQuotesAndEscapes } from "../../util";

const PROMPT = (
  input: string,
  title: string,
) => `You will be asked to generate the body of a GitHub issue given a user request. You should follow these rules:
- Be descriptive but do not make up details
- If the the user request includes any code snippets that are relevant, reference them in code blocks
- Describe step by step how to reproduce the problem
- Describe the ideal solution to the problem
- Describe the expected behavior after the issue has been resolved
- This issue will be read by a team member
- Use markdown formatting, but you do not need to surround the entire body with triple backticks
{additional_instructions}

Here is the user request: '${input}'

Title: ${title}

Body:\n\n`;

const DraftIssueCommand: SlashCommand = {
  name: "issue",
  description: "Draft a GitHub issue",
  run: async function* ({ input, llm, history, params }) {
    if (params?.repositoryUrl === undefined) {
      yield "This command requires a repository URL to be set in the config file.";
      return;
    }
    let title = await llm.complete(
      `Generate a title for the GitHub issue requested in this user input: '${input}'. Use no more than 20 words and output nothing other than the title. Do not surround it with quotes. The title is: `,
      { maxTokens: 20 },
    );

    title = removeQuotesAndEscapes(title.trim()) + "\n\n";
    yield title;

    let body = "";
    const messages: ChatMessage[] = [
      ...history,
      { role: "user", content: PROMPT(input, title) },
    ];

    for await (const chunk of llm.streamChat(messages)) {
      body += chunk.content;
      yield stripImages(chunk.content);
    }

    const url = `${params.repositoryUrl}/issues/new?title=${encodeURIComponent(
      title,
    )}&body=${encodeURIComponent(body)}`;
    yield `\n\n[Link to draft of issue](${url})`;
  },
};

export default DraftIssueCommand;
