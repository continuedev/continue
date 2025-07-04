import { ILLM } from "../..";
import { countTokensAsync } from "../../llm/countTokens";

export async function throwIfFileExceedsHalfOfContext(
  filepath: string,
  content: string,
  model: ILLM | null,
) {
  if (model) {
    const tokens = await countTokensAsync(content, model.title);
    const tokenLimit = model.contextLength / 2;
    if (tokens > tokenLimit) {
      throw new Error(
        `File ${filepath} is too large (${tokens} tokens vs ${tokenLimit} token limit). Try another approach`,
      );
    }
  }
}
