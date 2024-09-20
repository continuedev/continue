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

const REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;
export interface RepoMapOptions {
  includeSignatures?: boolean;
  dirs?: string[];
}

function indentMultilineString(str: string) {
  return str
    .split("\n")
    .map((line: any) => "\t" + line)
    .join("\n");
}

function isSnippetSameAsFile(snippet: string, fileContent: string): boolean {
  return snippet.trim() === fileContent.trim();
}

async function getPaths(dirs: string[], ide: IDE): Promise<Set<string>> {
  const paths = new Set<string>();

  for (const dir of dirs) {
    for await (const filepath of walkDirAsync(dir, ide)) {
      paths.add(filepath.replace(dir, "").slice(1));
    }
  }

  return paths;
}

async function initializeWriteStream(
  repoMapPath: string,
): Promise<fs.WriteStream> {
  if (fs.existsSync(repoMapPath)) {
    console.debug(`Overwriting existing repo map at ${repoMapPath}`);
  }
  const writeStream = fs.createWriteStream(repoMapPath);
  await new Promise((resolve) => writeStream.write(repoMapPreamble, resolve));
  return writeStream;
}

function generateContentForPath(
  absolutePath: string,
  signatures: string[],
  dirs: string[],
  { includeSignatures }: RepoMapOptions,
): string {
  const workspaceDir = dirs.find((dir) => absolutePath.startsWith(dir)) || "";
  const relativePath = path.relative(workspaceDir, absolutePath);

  let content = "";

  if (includeSignatures) {
    content += `${relativePath}:\n`;

    for (const signature of signatures.slice(0, -1)) {
      content += `${indentMultilineString(signature)}\n\t...\n`;
    }

    content += `${indentMultilineString(
      signatures[signatures.length - 1],
    )}\n\n`;
  } else {
    content += `${relativePath}\n`;
  }

  return content;
}

async function processPathsAndSignatures(
  llm: ILLM,
  dirs: string[],
  options: RepoMapOptions,
  writeStream: fs.WriteStream,
  maxRepoMapTokens: number,
): Promise<number> {
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
      const fileContent = await fs.promises.readFile(absolutePath, "utf8");
      const filteredSignatures = signatures.filter(
        (signature) => !isSnippetSameAsFile(signature, fileContent),
      );

      content += generateContentForPath(
        absolutePath,
        filteredSignatures,
        dirs,
        options,
      );
    }

    const contentTokens = llm.countTokens(content);

    if (curTokens + contentTokens >= maxRepoMapTokens) {
      const prunedContent = pruneLinesFromTop(
        content,
        maxRepoMapTokens - curTokens,
        llm.model,
      );
      await new Promise((resolve) => writeStream.write(prunedContent, resolve));
      return curTokens + llm.countTokens(prunedContent);
    } else {
      await new Promise((resolve) => writeStream.write(content, resolve));
      curTokens += contentTokens;
    }

    if (!hasMore) {
      break;
    }
    offset += batchSize;
  }

  return curTokens;
}

async function generateRepoMap(
  llm: ILLM,
  ide: IDE,
  options: RepoMapOptions = {},
) {
  const repoMapPath = getRepoMapFilePath();
  const dirs = options.dirs ?? (await ide.getWorkspaceDirs());
  const maxRepoMapTokens = llm.contextLength * REPO_MAX_CONTEXT_LENGTH_RATIO;

  const paths = await getPaths(dirs, ide);
  const writeStream = await initializeWriteStream(repoMapPath);

  const curTokens = await processPathsAndSignatures(
    llm,
    dirs,
    options,
    writeStream,
    maxRepoMapTokens,
  );

  const remainingPaths = Array.from(paths).join("\n");

  if (remainingPaths.length > 0) {
    await new Promise((resolve) => writeStream.write(remainingPaths, resolve));
  }

  writeStream.end();
  console.debug(`Generated repo map for ${dirs.join(", ")} at ${repoMapPath}`);

  if (curTokens >= maxRepoMapTokens) {
    console.debug(
      "Full repo map was unable to be generated due to context window limitations",
    );
  }

  return fs.readFileSync(repoMapPath, "utf8");
}

export default generateRepoMap;
