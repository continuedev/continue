import { ILLM } from "../..";
import { defaultFileAndFolderSecurityIgnores } from "../../indexing/ignore";
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

export async function throwIfFileIsSecurityConcern(filepath: string) {
  if (defaultFileAndFolderSecurityIgnores.ignores(filepath)) {
    throw new Error(
      `Reading or Editing ${filepath} is not allowed because it is a security concern. Do not attempt to read or edit this file in any way.`,
    );
  }
}
