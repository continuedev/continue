import fs from "node:fs";
import path from "node:path";
import { IDE, ILLM } from "..";
import { CodeSnippetsCodebaseIndex } from "../indexing/CodeSnippetsIndex";
import { walkDirAsync } from "../indexing/walkDir";
import { pruneLinesFromTop } from "../llm/countTokens";
import { getRepoMapFilePath } from "./paths";

const repoMapPreamble =
  "Below is a repository map. \n" +
  "For each file in the codebase, " +
  "this map contains the name of the file, and the signature for any " +
  "classes, methods, or functions in the file.\n\n";

// The max percent of the context window we will take
const REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;

function indentMultilineString(str: string) {
  return str
    .split("\n")
    .map((line: any) => "\t" + line)
    .join("\n");
}

export interface RepoMapOptions {
  signatures?: boolean;
  dirs?: string[];
}

async function generateRepoMap(llm: ILLM, ide: IDE, options?: RepoMapOptions) {
  const repoMapPath = getRepoMapFilePath();
  const dirs = options?.dirs ?? (await ide.getWorkspaceDirs());
  const maxRepoMapTokens = llm.contextLength * REPO_MAX_CONTEXT_LENGTH_RATIO;

  const pathsWithoutSnippets = new Set<string>();
  for (const dir of dirs) {
    for await (const filepath of walkDirAsync(dir, ide)) {
      pathsWithoutSnippets.add(filepath.replace(dir, "").slice(1));
    }
  }

  if (fs.existsSync(repoMapPath)) {
    console.debug(`Overwriting existing repo map at ${repoMapPath}`);
  }

  const writeStream = fs.createWriteStream(repoMapPath);
  await new Promise((resolve) => writeStream.write(repoMapPreamble, resolve));

  let curTokens = llm.countTokens(repoMapPreamble);
  let offset = 0;
  const batchSize = 100;

  while (true) {
    const { groupedByPath, hasMore } =
      await CodeSnippetsCodebaseIndex.getPathsAndSignatures(
        dirs,
        offset,
        batchSize,
      );

    let content = "";

    for (const [absolutePath, signatures] of Object.entries(groupedByPath)) {
      const workspaceDir =
        dirs.find((dir) => absolutePath.startsWith(dir)) || "";

      const relativePath = path.relative(workspaceDir, absolutePath);

      pathsWithoutSnippets.delete(relativePath);

      if (options?.signatures !== false) {
        content += `${relativePath}:\n`;
        for (const signature of signatures.slice(0, -1)) {
          content += `${indentMultilineString(signature)}\n\t...\n`;
        }
        if (signatures.length > 0) {
          // Don't add the trailing ellipsis for the last entry
          content += `${indentMultilineString(
            signatures[signatures.length - 1],
          )}\n\n`;
        }
      } else {
        // No signatures mode
        content += `${relativePath}\n`;
      }
    }

    const contentTokens = llm.countTokens(content);

    if (curTokens + contentTokens >= maxRepoMapTokens) {
      // Fit what we can, then stop
      const prunedContent = pruneLinesFromTop(
        content,
        maxRepoMapTokens - curTokens,
        llm.model,
      );
      await new Promise((resolve) => writeStream.write(prunedContent, resolve));
      break;
    } else {
      await new Promise((resolve) => writeStream.write(content, resolve));
    }

    curTokens += contentTokens;

    if (!hasMore) {
      break;
    }

    offset += batchSize;
  }

  const content = Array.from(pathsWithoutSnippets).join("\n");
  if (content.length > 0) {
    await new Promise((resolve) => writeStream.write(content, resolve));
  }

  writeStream.end();
  console.debug(`Generated repo map at ${repoMapPath}`);

  if (curTokens >= maxRepoMapTokens) {
    console.debug(
      "Full repo map was unable to be genereated due to context window limitations",
    );
  }

  const repoMap = fs.readFileSync(repoMapPath, "utf8");

  return repoMap;
}

export default generateRepoMap;
