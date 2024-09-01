import { Chunk, ContinueConfig, IDE, ILLM } from "../..";
import { stripImages } from "../../llm/images";
import generateRepoMap from "../../util/repoMap";

export async function requestFilesFromRepoMap(
  defaultLlm: ILLM,
  config: ContinueConfig,
  ide: IDE,
  input: string,
  filterDirectory?: string,
): Promise<Chunk[]> {
  const llm =
    config.models.find(
      (model) =>
        model.title === config.experimental?.modelRoles?.repoMapFileSelection,
    ) ?? defaultLlm;

  // Only supported for Claude models right now
  if (!llm.model.toLowerCase().includes("claude")) {
    return [];
  }

  try {
    const repoMap = await generateRepoMap(llm, ide, {
      signatures: false,
      dirs: filterDirectory ? [filterDirectory] : undefined,
    });

    const prompt = `${repoMap}

Given the above repo map, your task is to decide which files are most likely to be relevant in answering a question. Before giving your answer, you should write your reasoning about which files/folders are most important. This thinking should start with a <reasoning> tag, followed by a paragraph explaining your reasoning, and then a closing </reasoning> tag on the last line.

After this, your response should begin with a <results> tag, followed by a list of each file, one per line, and then a closing </results> tag on the last line. You should select between 5 and 10 files. The names that you list should be the full path from the root of the repo, not just the basename of the file.

This is the question that you should select relevant files for: "${input}"`;

    const response = await llm.chat([
      { role: "user", content: prompt },
      { role: "assistant", content: "<reasoning>" },
    ]);
    const content = stripImages(response.content);
    console.debug("Repo map retrieval response: ", content);

    if (!content.includes("\n")) {
      return [];
    }

    const pathSep = await ide.pathSep();
    const subDirPrefix = filterDirectory ? filterDirectory + pathSep : "";
    const files =
      content
        .split("<results>")[1]
        ?.split("</results>")[0]
        ?.split("\n")
        .filter(Boolean)
        .map((file) => file.trim())
        .map((file) => subDirPrefix + file) ?? [];

    const chunks = await Promise.all(
      files.map(async (file) => {
        const content = await ide.readFile(file);
        const lineCount = content.split("\n").length;
        const chunk: Chunk = {
          digest: file,
          content,
          filepath: file,
          endLine: lineCount - 1,
          startLine: 0,
          index: 0,
        };
        return chunk;
      }),
    );

    return chunks;
  } catch (e) {
    console.debug("Error requesting files from repo map", e);
    return [];
  }
}
