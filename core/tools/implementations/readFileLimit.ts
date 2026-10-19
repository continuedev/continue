import { ILLM } from "../..";
import { countTokensAsync } from "../../llm/countTokens";
import { ContinueError, ContinueErrorReason } from "../../util/errors";

const DEFAULT_BASELINE_CONTEXT_LENGTH = 64000;

export async function throwIfFileExceedsHalfOfContext(
  filepath: string,
  content: string,
  model: ILLM | null,
) {
  if (model) {
    const contextLength =
      !model.contextLength || model.contextLength <= 16384
        ? DEFAULT_BASELINE_CONTEXT_LENGTH
        : model.contextLength;

    const tokens = await countTokensAsync(content, model.title);
    const tokenLimit = Math.floor(contextLength * 0.75);
    if (tokens > tokenLimit) {
      throw new ContinueError(
        ContinueErrorReason.FileTooLarge,
        `File ${filepath} is too large (${tokens} tokens vs ${tokenLimit} token limit). Consider reading specific line ranges or checking your model's contextLength configuration.`,
      );
    }
  }
}
