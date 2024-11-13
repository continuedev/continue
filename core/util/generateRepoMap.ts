import fs from "node:fs";
import path from "node:path";

import { IDE, ILLM } from "..";
import { CodeSnippetsCodebaseIndex } from "../indexing/CodeSnippetsIndex";
import { walkDirAsync } from "../indexing/walkDir";
import { pruneLinesFromTop } from "../llm/countTokens";

import { getRepoMapFilePath } from "./paths";

export interface RepoMapOptions {
  includeSignatures?: boolean;
  dirs?: string[];
}

class RepoMapGenerator {
  private maxRepoMapTokens: number;

  private repoMapPath: string = getRepoMapFilePath();
  private writeStream: fs.WriteStream = fs.createWriteStream(this.repoMapPath);
  private contentTokens: number = 0;
  private repoMapDirs: string[] = [];
  private allPathsInDirs: Set<string> = new Set();
  private pathsInDirsWithSnippets: Set<string> = new Set();

  private BATCH_SIZE = 100;
  private REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;
  private PREAMBLE =
    "Below is a repository map. \n" +
    "For each file in the codebase, " +
    "this map contains the name of the file, and the signature for any " +
    "classes, methods, or functions in the file.\n\n";

  constructor(
    private llm: ILLM,
    private ide: IDE,
    private options: RepoMapOptions,
  ) {
    this.maxRepoMapTokens =
      llm.contextLength * this.REPO_MAX_CONTEXT_LENGTH_RATIO;
  }

  async generate(): Promise<string> {
    this.repoMapDirs = this.options.dirs ?? (await this.ide.getWorkspaceDirs());
    this.allPathsInDirs = await this.getAllPathsInDirs();

    await this.initializeWriteStream();
    await this.processPathsAndSignatures();

    this.writeStream.end();
    this.logRepoMapGeneration();

    return fs.readFileSync(this.repoMapPath, "utf8");
  }

  private async initializeWriteStream(): Promise<void> {
    await this.writeToStream(this.PREAMBLE);
    this.contentTokens += this.llm.countTokens(this.PREAMBLE);
  }

  private async getAllPathsInDirs(): Promise<Set<string>> {
    const paths = new Set<string>();

    for (const dir of this.repoMapDirs) {
      for await (const filepath of walkDirAsync(dir, this.ide)) {
        paths.add(filepath.replace(dir, "").slice(1));
      }
    }

    return paths;
  }

  private async processPathsAndSignatures(): Promise<void> {
    let offset = 0;
    while (true) {
      const { groupedByPath, hasMore } =
        await CodeSnippetsCodebaseIndex.getPathsAndSignatures(
          this.repoMapDirs,
          offset,
          this.BATCH_SIZE,
        );
      await this.processBatch(groupedByPath);
      if (!hasMore || this.contentTokens >= this.maxRepoMapTokens) {
        break;
      }
      offset += this.BATCH_SIZE;
    }
    await this.writeRemainingPaths();
  }

  private async processBatch(
    groupedByPath: Record<string, string[]>,
  ): Promise<void> {
    for (const [absolutePath, signatures] of Object.entries(groupedByPath)) {
      const content = await this.processFile(absolutePath, signatures);

      if (content) {
        await this.writeToStream(content);
      }
    }
  }

  private async processFile(
    absolutePath: string,
    signatures: string[],
  ): Promise<string | undefined> {
    const workspaceDir =
      this.repoMapDirs.find((dir) => absolutePath.startsWith(dir)) || "";
    const relativePath = path.relative(workspaceDir, absolutePath);

    let fileContent: string;

    try {
      fileContent = await fs.promises.readFile(absolutePath, "utf8");
    } catch (err) {
      console.error(
        "Failed to read file:\n" +
          `  Path: ${absolutePath}\n` +
          `  Error: ${err instanceof Error ? err.message : String(err)}`,
      );

      return;
    }

    const filteredSignatures = signatures.filter(
      (signature) => signature.trim() !== fileContent.trim(),
    );

    if (filteredSignatures.length > 0) {
      this.pathsInDirsWithSnippets.add(relativePath);
    }

    return this.generateContentForPath(relativePath, filteredSignatures);
  }

  private generateContentForPath(
    relativePath: string,
    signatures: string[],
  ): string {
    if (this.options.includeSignatures === false) {
      return `${relativePath}\n`;
    }

    let content = `${relativePath}:\n`;

    for (const signature of signatures.slice(0, -1)) {
      content += `${this.indentMultilineString(signature)}\n\t...\n`;
    }

    content += `${this.indentMultilineString(
      signatures[signatures.length - 1],
    )}\n\n`;

    return content;
  }

  private async writeToStream(content: string): Promise<void> {
    const tokens = this.llm.countTokens(content);

    if (this.contentTokens + tokens > this.maxRepoMapTokens) {
      content = pruneLinesFromTop(
        content,
        this.maxRepoMapTokens - this.contentTokens,
        this.llm.model,
      );
    }

    this.contentTokens += this.llm.countTokens(content);

    await new Promise((resolve) => this.writeStream.write(content, resolve));
  }

  private async writeRemainingPaths(): Promise<void> {
    const pathsWithoutSnippets = new Set(
      [...this.allPathsInDirs].filter(
        (x) => !this.pathsInDirsWithSnippets.has(x),
      ),
    );

    if (pathsWithoutSnippets.size > 0) {
      await this.writeToStream(Array.from(pathsWithoutSnippets).join("\n"));
    }
  }

  private logRepoMapGeneration(): void {
    console.debug(
      `Generated repo map for ${this.repoMapDirs.join(", ")} at ${
        this.repoMapPath
      }`,
    );
    if (this.contentTokens >= this.maxRepoMapTokens) {
      console.debug(
        "Full repo map was unable to be generated due to context window limitations",
      );
    }
  }

  private indentMultilineString(str: string) {
    return str
      .split("\n")
      .map((line: any) => "\t" + line)
      .join("\n");
  }
}

export default async function generateRepoMap(
  llm: ILLM,
  ide: IDE,
  options: RepoMapOptions,
): Promise<string> {
  const generator = new RepoMapGenerator(llm, ide, options);
  return generator.generate();
}
