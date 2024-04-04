import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";
import { ChatMessage } from "../..";

function getLastUserHistory(history: ChatMessage[]): string {
  let lastUserHistory: ChatMessage | undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      lastUserHistory = history[i];
      break;
    }
  }

  let mergedText = "";

  if (lastUserHistory) {
    if (Array.isArray(lastUserHistory.content)) {
      mergedText = lastUserHistory.content.reduce(
        (acc: string, current: { type: string; text?: string }) => {
          if (current.type === "text" && current.text) {
            return acc + current.text;
          }
          return acc;
        },
        ""
      );
    } else if (typeof lastUserHistory.content === "string") {
      mergedText = lastUserHistory.content;
    }
  }

  return mergedText;
}

const ReviewMessageCommand: SlashCommand = {
  name: "review",
  description: "Review code and give feedback",
  run: async function* ({ llm, history }) {
    
    let reviewText = getLastUserHistory(history).replace("\\review", "");

    const prompt = `
    "Review the following code, focusing on Readability, Maintainability, Code Smells, Speed, and Memory Performance. Provide feedback with these guidelines:

     Tone: Friendly casual tone of a fellow engineer, ensure the feedback is clear and focused on practical improvements.
     Orderly Analysis: Address the code sequentially, from top to bottom, to ensure a thorough review without skipping any parts.
     Descriptive Feedback: Avoid referencing line numbers directly, as they may vary. Instead, describe the code sections or specific constructs that need attention, explaining the reasons clearly.
     Provide Examples: For each issue identified, offer an example of how the code could be improved or rewritten for better clarity, performance, or maintainability.
     Your response should be structured to first identify the issue, then explain why it’s a problem, and finally, offer a solution with example code.

    ${reviewText}`;

    for await (const chunk of llm.streamChat([
      { role: "user", content: prompt },
    ])) {
      yield stripImages(chunk.content);
    }
  },
};

export default ReviewMessageCommand;
