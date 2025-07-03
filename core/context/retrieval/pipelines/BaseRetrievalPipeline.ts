// @ts-ignore
import nlp from "wink-nlp-utils";

import {
  BranchAndDir,
  Chunk,
  ContextItem,
  ContinueConfig,
  IDE,
  ILLM,
  Tool,
  ToolExtras,
} from "../../../";
import { openedFilesLruCache } from "../../../autocomplete/util/openedFilesLruCache";
import { chunkDocument } from "../../../indexing/chunk/chunk";
import { FullTextSearchCodebaseIndex } from "../../../indexing/FullTextSearchCodebaseIndex";
import { LanceDbIndex } from "../../../indexing/LanceDbIndex";
import { BuiltInToolNames } from "../../../tools/builtIn";
import { globSearchTool } from "../../../tools/definitions/globSearch";
import { grepSearchTool } from "../../../tools/definitions/grepSearch";
import { lsTool } from "../../../tools/definitions/lsTool";
import { readFileTool } from "../../../tools/definitions/readFile";
import { viewRepoMapTool } from "../../../tools/definitions/viewRepoMap";
import { viewSubdirectoryTool } from "../../../tools/definitions/viewSubdirectory";
import { fileGlobSearchImpl } from "../../../tools/implementations/globSearch";
import { grepSearchImpl } from "../../../tools/implementations/grepSearch";
import { lsToolImpl } from "../../../tools/implementations/lsTool";
import { readFileImpl } from "../../../tools/implementations/readFile";
import { viewRepoMapImpl } from "../../../tools/implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "../../../tools/implementations/viewSubdirectory";

const DEFAULT_CHUNK_SIZE = 384;

const availableTools: Tool[] = [
  globSearchTool,
  grepSearchTool,
  lsTool,
  readFileTool,
  viewRepoMapTool,
  viewSubdirectoryTool,
];

export interface RetrievalPipelineOptions {
  llm: ILLM;
  config: ContinueConfig;
  ide: IDE;
  input: string;
  nRetrieve: number;
  nFinal: number;
  tags: BranchAndDir[];
  filterDirectory?: string;
}

export interface RetrievalPipelineRunArguments {
  query: string;
  tags: BranchAndDir[];
  filterDirectory?: string;
  includeEmbeddings: boolean;
}

export interface IRetrievalPipeline {
  run(args: RetrievalPipelineRunArguments): Promise<Chunk[]>;
}

export default class BaseRetrievalPipeline implements IRetrievalPipeline {
  private ftsIndex = new FullTextSearchCodebaseIndex();
  private lanceDbIndex: LanceDbIndex | null = null;

  constructor(protected readonly options: RetrievalPipelineOptions) {
    void this.initLanceDb();
  }

  private async initLanceDb() {
    const embedModel = this.options.config.selectedModelByRole.embed;

    if (!embedModel) {
      return;
    }

    this.lanceDbIndex = await LanceDbIndex.create(embedModel, (uri) =>
      this.options.ide.readFile(uri),
    );
  }

  private getCleanedTrigrams(
    query: RetrievalPipelineRunArguments["query"],
  ): string[] {
    let text = nlp.string.removeExtraSpaces(query);
    text = nlp.string.stem(text);

    let tokens = nlp.string
      .tokenize(text, true)
      .filter((token: any) => token.tag === "word")
      .map((token: any) => token.value);

    tokens = nlp.tokens.removeWords(tokens);
    tokens = nlp.tokens.setOfWords(tokens);

    const cleanedTokens = [...tokens].join(" ");
    const trigrams = nlp.string.ngram(cleanedTokens, 3);

    return trigrams.map(this.escapeFtsQueryString);
  }

  private escapeFtsQueryString(query: string): string {
    const escapedDoubleQuotes = query.replace(/"/g, '""');
    return `"${escapedDoubleQuotes}"`;
  }

  protected async retrieveFts(
    args: RetrievalPipelineRunArguments,
    n: number,
  ): Promise<Chunk[]> {
    if (args.query.trim() === "") {
      return [];
    }

    const tokens = this.getCleanedTrigrams(args.query).join(" OR ");

    return await this.ftsIndex.retrieve({
      n,
      text: tokens,
      tags: args.tags,
      directory: args.filterDirectory,
    });
  }

  protected async retrieveAndChunkRecentlyEditedFiles(
    n: number,
  ): Promise<Chunk[]> {
    const recentlyEditedFilesSlice = Array.from(
      openedFilesLruCache.keys(),
    ).slice(0, n);

    // If the number of recently edited files is less than the retrieval limit,
    // include additional open files. This is useful in the case where a user
    // has many tabs open and reloads their IDE. They now have 0 recently edited files,
    // but many open tabs that represent what they were working on prior to reload.
    if (recentlyEditedFilesSlice.length < n) {
      const openFiles = await this.options.ide.getOpenFiles();
      recentlyEditedFilesSlice.push(
        ...openFiles.slice(0, n - recentlyEditedFilesSlice.length),
      );
    }

    const chunks: Chunk[] = [];

    for (const filepath of recentlyEditedFilesSlice) {
      const contents = await this.options.ide.readFile(filepath);
      const fileChunks = chunkDocument({
        filepath,
        contents,
        maxChunkSize:
          this.options.config.selectedModelByRole.embed
            ?.maxEmbeddingChunkSize ?? DEFAULT_CHUNK_SIZE,
        digest: filepath,
      });

      for await (const chunk of fileChunks) {
        chunks.push(chunk);
      }
    }

    return chunks.slice(0, n);
  }

  protected async retrieveEmbeddings(
    input: string,
    n: number,
  ): Promise<Chunk[]> {
    if (!this.lanceDbIndex) {
      console.warn(
        "LanceDB index not available, skipping embeddings retrieval",
      );
      return [];
    }

    return this.lanceDbIndex.retrieve(
      input,
      n,
      this.options.tags,
      this.options.filterDirectory,
    );
  }

  run(_args: RetrievalPipelineRunArguments): Promise<Chunk[]> {
    throw new Error("Not implemented");
  }

  protected async retrieveWithTools(input: string): Promise<Chunk[]> {
    const toolSelectionPrompt = `Given the following user input: "${input}"

Available tools:
${availableTools
  .map((tool) => {
    const requiredParams = tool.function.parameters?.required || [];
    const properties = tool.function.parameters?.properties || {};
    const paramDescriptions = requiredParams
      .map(
        (param: any) =>
          `${param}: ${properties[param]?.description || "string"}`,
      )
      .join(", ");

    return `- ${tool.function.name}: ${tool.function.description}
  Required arguments: ${paramDescriptions || "none"}`;
  })
  .join("\n")}

Determine which tools should be used to answer this query. You should feel free to use multiple tools when they would be helpful for comprehensive results. Respond ONLY a JSON object containing the following and nothing else:
{
  "tools": [
    {
      "name": "<tool_name>",
      "args": { "<required_parameter_name>": "<required_parameter_value>" }
    }
  ]
}`;

    // Get LLM response for tool selection
    const toolSelectionResponse = await this.options.llm.complete(
      toolSelectionPrompt,
      new AbortController().signal,
    );

    let toolCalls: { name: string; args: any }[] = [];
    try {
      const parsed = JSON.parse(toolSelectionResponse);
      toolCalls = parsed.tools || [];
      console.log("retrieveWithTools", toolCalls);
    } catch (e) {
      console.log("Failed to parse tool selection response", e);
      return [];
    }

    // Execute tools and collect results
    const allContextItems: ContextItem[] = [];

    const toolExtras: ToolExtras = {
      ide: this.options.ide,
      llm: this.options.llm,
      fetch: fetch,
      tool: grepSearchTool,
      config: this.options.config,
    };

    for (const toolCall of toolCalls) {
      switch (toolCall.name) {
        case BuiltInToolNames.FileGlobSearch:
          toolExtras.tool = globSearchTool;
          const globSearchContextItems = await fileGlobSearchImpl(
            toolCall.args,
            toolExtras,
          );
          allContextItems.push(...globSearchContextItems);
          break;

        case BuiltInToolNames.GrepSearch:
          toolExtras.tool = grepSearchTool;
          const grepContextItems = await grepSearchImpl(
            toolCall.args,
            toolExtras,
          );
          allContextItems.push(...grepContextItems);
          break;

        case BuiltInToolNames.LSTool:
          toolExtras.tool = lsTool;
          const lsContextItems = await lsToolImpl(toolCall.args, toolExtras);
          allContextItems.push(...lsContextItems);
          break;

        case BuiltInToolNames.ReadFile:
          toolExtras.tool = readFileTool;
          const readFileImplContextItems = await readFileImpl(
            toolCall.args,
            toolExtras,
          );
          allContextItems.push(...readFileImplContextItems);
          break;

        case BuiltInToolNames.ViewRepoMap:
          toolExtras.tool = viewRepoMapTool;
          const repoMapContextItems = await viewRepoMapImpl(
            toolCall.args,
            toolExtras,
          );
          allContextItems.push(...repoMapContextItems);
          break;

        case BuiltInToolNames.ViewSubdirectory:
          toolExtras.tool = viewSubdirectoryTool;
          const viewSubdirContextItems = await viewSubdirectoryImpl(
            toolCall.args,
            toolExtras,
          );
          allContextItems.push(...viewSubdirContextItems);
          break;
      }
    }

    const chunks: Chunk[] = [];

    // Transform ContextItem[] to Chunk[]
    for (const contextItem of allContextItems) {
      const content = contextItem.content;
      const matches = [...content.matchAll(/^\.\/([^\n]+)$/gm)];

      if (matches.length === 0) {
        // single chunk content or no file path patterns found that need to be split
        const filepath =
          contextItem.uri?.value || contextItem.name || "unknown";
        const cleanedFilepath = filepath.replace(/^file:\/\/\//, "");

        chunks.push({
          content: contextItem.content,
          startLine: -1,
          endLine: -1,
          digest: `file:///${cleanedFilepath}`,
          filepath: `file:///${cleanedFilepath}`,
          index: 0,
        });
      } else {
        // Split grep search results by file paths and create separate chunks
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const filepath = match[1];
          const startIndex = match.index!;
          const endIndex =
            i < matches.length - 1 ? matches[i + 1].index! : content.length;

          // Extract grepped content for this file
          const fileContent = content
            .substring(startIndex, endIndex)
            .replace(/^\.\/[^\n]+\n/, "") // remove the line with file path
            .trim();

          if (fileContent) {
            // getUriDescription expects a full file path
            const fullFilePath = `file:///${filepath}`;
            chunks.push({
              content: fileContent,
              startLine: -1,
              endLine: -1,
              digest: fullFilePath,
              filepath: fullFilePath,
              index: i,
            });
          }
        }
      }
    }

    console.log("retrieveWithTools chunks", chunks);
    return chunks;
  }
}
