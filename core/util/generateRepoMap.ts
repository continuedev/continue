import fs from "node:fs";

import { IDE, ILLM } from "..";
import { CodeSnippetsCodebaseIndex } from "../indexing/CodeSnippetsIndex";
import { walkDirs } from "../indexing/walkDir";
import { pruneLinesFromTop } from "../llm/countTokens";

import { getRepoMapFilePath } from "./paths";
import { findUriInDirs } from "./uri";

export interface RepoMapOptions {
  includeSignatures?: boolean;
  dirUris?: string[];
  outputRelativeUriPaths: boolean;
}

class RepoMapGenerator {
  private maxRepoMapTokens: number;

  private repoMapPath: string = getRepoMapFilePath();
  private writeStream: fs.WriteStream = fs.createWriteStream(this.repoMapPath);
  private contentTokens: number = 0;
  private dirs: string[] = [];
  private allUris: string[] = [];
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

  private getUriForWrite(uri: string) {
    if (this.options.outputRelativeUriPaths) {
      return findUriInDirs(uri, this.dirs).relativePathOrBasename;
    }
    return uri;
  }

  async generate(): Promise<string> {
    this.dirs = this.options.dirUris ?? (await this.ide.getWorkspaceDirs());
    this.allUris = await walkDirs(
      this.ide,
      {
        source: "generate repo map",
      },
      this.dirs,
    );

    // Initialize
    await this.writeToStream(this.PREAMBLE);

    if (this.options.includeSignatures) {
      // Process uris and signatures
      let offset = 0;
      while (true) {
        const { groupedByUri, hasMore } =
          await CodeSnippetsCodebaseIndex.getPathsAndSignatures(
            this.allUris,
            offset,
            this.BATCH_SIZE,
          );
        // process batch
        for (const [uri, signatures] of Object.entries(groupedByUri)) {
          let fileContent: string;

          try {
            fileContent = await this.ide.readFile(uri);
          } catch (err) {
            console.error(
              "Failed to read file:\n" +
                `  Uri: ${uri}\n` +
                `  Error: ${err instanceof Error ? err.message : String(err)}`,
            );

            continue;
          }

          const filteredSignatures = signatures.filter(
            (signature) => signature.trim() !== fileContent.trim(),
          );

          if (filteredSignatures.length > 0) {
            this.pathsInDirsWithSnippets.add(uri);
          }

          let content = `${this.getUriForWrite(uri)}:\n`;

          for (const signature of signatures.slice(0, -1)) {
            content += `${this.indentMultilineString(signature)}\n\t...\n`;
          }

          content += `${this.indentMultilineString(
            signatures[signatures.length - 1],
          )}\n\n`;

          if (content) {
            await this.writeToStream(content);
          }
        }
        if (!hasMore || this.contentTokens >= this.maxRepoMapTokens) {
          break;
        }
        offset += this.BATCH_SIZE;
      }

      // Remaining Uris just so that written repo map isn't incomplete
      const urisWithoutSnippets = this.allUris.filter(
        (uri) => !this.pathsInDirsWithSnippets.has(uri),
      );

      if (urisWithoutSnippets.length > 0) {
        await this.writeToStream(
          urisWithoutSnippets.map((uri) => this.getUriForWrite(uri)).join("\n"),
        );
      }
    } else {
      // Only process uris
      await this.writeToStream(
        this.allUris.map((uri) => this.getUriForWrite(uri)).join("\n"),
      );
    }

    this.writeStream.end();

    if (this.contentTokens >= this.maxRepoMapTokens) {
      console.debug(
        "Full repo map was unable to be generated due to context window limitations",
      );
    }

    return fs.readFileSync(this.repoMapPath, "utf8");
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
