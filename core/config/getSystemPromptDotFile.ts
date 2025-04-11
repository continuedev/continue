import { IDE } from "..";
import { joinPathsToUri } from "../util/uri";
export const SYSTEM_PROMPT_DOT_FILE = ".continuerules";

export async function getSystemPromptDotFile(ide: IDE): Promise<string | null> {
  const dirs = await ide.getWorkspaceDirs();

  let prompts: string[] = [];
  for (const dir of dirs) {
    try {
      const dotFile = joinPathsToUri(dir, SYSTEM_PROMPT_DOT_FILE);
      const exists = await ide.fileExists(dotFile);
      if (exists) {
        const content = await ide.readFile(dotFile);
        prompts.push(content);
      }
    } catch (e) {
      console.error(`Failed to read rules file at ${dir}: ${e}`);
    }
  }

  if (!prompts.length) {
    return null;
  }

  return prompts.join("\n\n");
}
