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

const BATCH_SIZE = 100;

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
  relativePath: string,
  signatures: string[],
  { includeSignatures }: RepoMapOptions,
): string {
  let content = "";

  if (includeSignatures !== false) {
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
  maxRepoMapTokens: number,
  ide: IDE,
): Promise<{ content: string; remainingPaths: Set<string> }> {
  const paths = await getPaths(dirs, ide);
  let pathsWithoutSignatures = new Set<string>(paths);

  let content = "";
  let curTokens = llm.countTokens(repoMapPreamble);
  let offset = 0;

  while (true) {
    const { groupedByPath, hasMore } =
      await CodeSnippetsCodebaseIndex.getPathsAndSignatures(
        dirs,
        offset,
        BATCH_SIZE,
      );

    const { batchContent, updatedPathsWithoutSignatures } = await processBatch(
      groupedByPath,
      dirs,
      options,
      pathsWithoutSignatures,
    );

    pathsWithoutSignatures = updatedPathsWithoutSignatures;

    const batchTokens = llm.countTokens(batchContent);

    if (curTokens + batchTokens >= maxRepoMapTokens) {
      content += pruneLinesFromTop(
        batchContent,
        maxRepoMapTokens - curTokens,
        llm.model,
      );
      break;
    }

    content += batchContent;
    curTokens += batchTokens;

    if (!hasMore) {
      break;
    }
    offset += BATCH_SIZE;
  }

  return { content, remainingPaths: pathsWithoutSignatures };
}

async function processBatch(
  groupedByPath: Record<string, string[]>,
  dirs: string[],
  options: RepoMapOptions,
  pathsWithoutSignatures: Set<string>,
): Promise<{
  batchContent: string;
  updatedPathsWithoutSignatures: Set<string>;
}> {
  let batchContent = "";
  const updatedPathsWithoutSignatures = new Set(pathsWithoutSignatures);

  for (const [absolutePath, signatures] of Object.entries(groupedByPath)) {
    const { content } = await processFile(
      absolutePath,
      signatures,
      dirs,
      options,
      updatedPathsWithoutSignatures,
    );
    batchContent += content;
  }
  return { batchContent, updatedPathsWithoutSignatures };
}

async function processFile(
  absolutePath: string,
  signatures: string[],
  dirs: string[],
  options: RepoMapOptions,
  pathsWithoutSignatures: Set<string>,
): Promise<{ relativePath: string; content: string }> {
  const workspaceDir = dirs.find((dir) => absolutePath.startsWith(dir)) || "";
  const relativePath = path.relative(workspaceDir, absolutePath);

  const fileContent = await fs.promises.readFile(absolutePath, "utf8");
  const filteredSignatures = signatures.filter(
    (signature) => !isSnippetSameAsFile(signature, fileContent),
  );

  if (filteredSignatures.length > 0) {
    pathsWithoutSignatures.delete(relativePath);
  }

  const content = generateContentForPath(
    relativePath,
    filteredSignatures,
    options,
  );
  return { relativePath, content };
}

async function writeContentToStream(
  writeStream: fs.WriteStream,
  content: string,
): Promise<void> {
  await new Promise((resolve) => writeStream.write(content, resolve));
}

async function writeRemainingPaths(
  writeStream: fs.WriteStream,
  remainingPaths: Set<string>,
): Promise<void> {
  if (remainingPaths.size > 0) {
    await new Promise((resolve) =>
      writeStream.write(Array.from(remainingPaths).join("\n"), resolve),
    );
  }
}

function logRepoMapGeneration(
  dirs: string[],
  repoMapPath: string,
  contentTokens: number,
  maxRepoMapTokens: number,
): void {
  console.debug(`Generated repo map for ${dirs.join(", ")} at ${repoMapPath}`);
  if (contentTokens >= maxRepoMapTokens) {
    console.debug(
      "Full repo map was unable to be generated due to context window limitations",
    );
  }
}

async function generateRepoMap(llm: ILLM, ide: IDE, options: RepoMapOptions) {
  const repoMapPath = getRepoMapFilePath();
  const dirs = options.dirs ?? (await ide.getWorkspaceDirs());
  const maxRepoMapTokens = llm.contextLength * REPO_MAX_CONTEXT_LENGTH_RATIO;
  const writeStream = await initializeWriteStream(repoMapPath);

  const { content, remainingPaths } = await processPathsAndSignatures(
    llm,
    dirs,
    options,
    maxRepoMapTokens,
    ide,
  );

  await writeContentToStream(writeStream, content);
  await writeRemainingPaths(writeStream, remainingPaths);

  writeStream.end();

  logRepoMapGeneration(
    dirs,
    repoMapPath,
    llm.countTokens(content),
    maxRepoMapTokens,
  );

  return fs.readFileSync(repoMapPath, "utf8");
}

export default generateRepoMap;
