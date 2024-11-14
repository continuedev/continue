import { IDE } from "..";

export const SYSTEM_PROMPT_DOT_FILE = ".continuerules";

export async function getSystemPromptDotFile(ide: IDE): Promise<string | null> {
  const dirs = await ide.getWorkspaceDirs();

  let prompts: string[] = [];
  const pathSep = await ide.pathSep();
  for (const dir of dirs) {
    const dotFile = `${dir}${pathSep}${SYSTEM_PROMPT_DOT_FILE}`;
    if (await ide.fileExists(dotFile)) {
      try {
        const content = await ide.readFile(dotFile);
        prompts.push(content);
      } catch (e) {
        // ignore if file doesn't exist
      }
    }
  }

  if (!prompts.length) {
    return null;
  }

  return prompts.join("\n\n");
}
