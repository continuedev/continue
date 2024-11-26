import { Chunk } from "../../../index.js";
import { RETRIEVAL_PARAMS } from "../../../util/parameters.js";
import { requestFilesFromRepoMap } from "../repoMapRequest.js";
import { deduplicateChunks } from "../util.js";
import BaseRetrievalPipeline from "./BaseRetrievalPipeline.js";

export default class RerankerRetrievalPipeline extends BaseRetrievalPipeline {
  private async _retrieveInitial(): Promise<Chunk[]> {
    const { input, nRetrieve, filterDirectory } = this.options;

    let retrievalResults: Chunk[] = [];

    const ftsstartTime = Date.now();
    const ftsChunks = await this.retrieveFts(input, nRetrieve);
    const ftstime = Date.now() - ftsstartTime;
    // this.writeLog(
    //   "core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"+
    //   "retrieveFts - time: " + ftstime/1000 + "s\n" +
    //   "retrieveFts - ftsChunks: " + JSON.stringify({...ftsChunks},null,2) + "\n"
    // );
    
    const embeddingsstartTime = Date.now();
    const embeddingsChunks = await this.retrieveEmbeddings(input, nRetrieve);
    const embeddingstime = Date.now() - embeddingsstartTime;
    // this.writeLog(
    //   "core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"+
    //   "retrieveEmbeddings - time: " + embeddingstime/1000 + "s\n" +
    //   "retrieveEmbeddings - embeddingsChunks: " + JSON.stringify({...embeddingsChunks},null,2) + "\n"
    // );

    // const recentlyEditedFilesstartTime = Date.now();
    // const recentlyEditedFilesChunks = await this.retrieveAndChunkRecentlyEditedFiles(nRetrieve);
    // const recentlyEditedFilestime = Date.now() - recentlyEditedFilesstartTime;
    // this.writeLog( 
    //   "core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n" +
    //   "retrieveAndChunkRecentlyEditedFiles - time: " + recentlyEditedFilestime/1000 + "s\n" +
    //   "retrieveAndChunkRecentlyEditedFiles - recentlyEditedFilesChunks: " + JSON.stringify({...recentlyEditedFilesChunks},null,2) + "\n"
    // );

    const repoMapstartTime = Date.now();
    const repoMapChunks = await requestFilesFromRepoMap(
      this.options.llm,
      this.options.config,
      this.options.ide,
      input,
      filterDirectory,
    );
    const repoMapTime = Date.now() - repoMapstartTime;
    // this.writeLog(
    //   "core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"+
    //   "requestFilesFromRepoMap - time: " + repoMapTime/1000 + "s\n" +
    //   "requestFilesFromRepoMap - repoMapChunks: " + JSON.stringify({...repoMapChunks},null,2) + "\n"
    // );

    retrievalResults.push(
      // ...recentlyEditedFilesChunks,
      ...ftsChunks,
      ...embeddingsChunks,
      ...repoMapChunks,
    );
    
    if (filterDirectory) {
      // Backup if the individual retrieval methods don't listen
      retrievalResults = retrievalResults.filter((chunk) =>
        chunk.filepath.startsWith(filterDirectory),
      );
    }

    const deduplicatedRetrievalResults: Chunk[] =
      deduplicateChunks(retrievalResults);

    // this.writeLog(
    //   "文件路径：/ai4math/users/xmlu/continue_env/continue/core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"
    //   + "ftsChunks: " + JSON.stringify({...ftsChunks},null,2) +"\n" 
    //   + "embeddingsChunks: "+JSON.stringify({...embeddingsChunks},null,2)+"\n"
    //   + "recentlyEditedFilesChunks: "+JSON.stringify({...recentlyEditedFilesChunks},null,2)+"\n"
    //   + "repoMapChunks: "+JSON.stringify({...repoMapChunks},null,2)+"\n"
    //   + "retrievalResults: "+JSON.stringify({...retrievalResults},null,2)+"\n"
    //   + "deduplicatedRetrievalResults: "+JSON.stringify({...deduplicatedRetrievalResults},null,2)+"\n"
    // );
    
    return deduplicatedRetrievalResults.slice(0, 32);
  }

  private async _rerank(input: string, chunks: Chunk[]): Promise<Chunk[]> {
    if (!this.options.config.reranker) {
      throw new Error("No reranker provided");
    }

    // remove empty chunks -- some APIs fail on that
    chunks = chunks.filter((chunk) => chunk.content);

    let scores: number[] = await this.options.config.reranker.rerank(
      input,
      chunks,
    );
    

    // Filter out low-scoring results
    let results = chunks;
    // let results = chunks.filter(
    //   (_, i) => scores[i] >= RETRIEVAL_PARAMS.rerankThreshold,
    // );
    // scores = scores.filter(
    //   (score) => score >= RETRIEVAL_PARAMS.rerankThreshold,
    // );

    const chunkIndexMap = new Map<Chunk, number>();
    chunks.forEach((chunk, idx) => chunkIndexMap.set(chunk, idx));

    results.sort(
      (a, b) => scores[chunkIndexMap.get(a)!] - scores[chunkIndexMap.get(b)!],
    );
    results = results.slice(-this.options.nFinal);
    return results;
  }

  private async _expandWithEmbeddings(chunks: Chunk[]): Promise<Chunk[]> {
    const topResults = chunks.slice(
      -RETRIEVAL_PARAMS.nResultsToExpandWithEmbeddings,
    );

    const expanded = await Promise.all(
      topResults.map(async (chunk, i) => {
        const results = await this.retrieveEmbeddings(
          chunk.content,
          RETRIEVAL_PARAMS.nEmbeddingsExpandTo,
        );
        return results;
      }),
    );
    return expanded.flat();
  }

  private async _expandRankedResults(chunks: Chunk[]): Promise<Chunk[]> {
    let results: Chunk[] = [];

    const embeddingsResults = await this._expandWithEmbeddings(chunks);
    results.push(...embeddingsResults);

    return results;
  }

  async run(): Promise<Chunk[]> {
    const retrievestartTime = Date.now();
    const intialResults = await this._retrieveInitial();
    const retrievetime = Date.now() - retrievestartTime;
    // this.writeLog(
    //   "Document Path: /ai4math/users/xmlu/continue_env/continue/core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"+
    //   "检索 耗时："+retrievetime/1000+"s\n"
    // );

    const rerankstartTime = Date.now();
    const rankedResults = await this._rerank(this.options.input, intialResults);
    const reranktime = Date.now() - rerankstartTime;
    // this.writeLog(
    //   "Document Path: /ai4math/users/xmlu/continue_env/continue/core/context/retrieval/pipelines/RerankerRetrievalPipeline.ts\n"+
    //   "rerank 耗时："+reranktime/1000+"s\n"
    // );
    

    // // // Expand top reranked results
    // const expanded = await this._expandRankedResults(results);
    // results.push(...expanded);

    // // De-duplicate
    // results = deduplicateChunks(results);

    // // Rerank again
    // results = await this._rerank(input, results);

    // TODO: stitch together results

    return rankedResults;
  }
}

// Source: expansion with code graph
// consider doing this after reranking? Or just having a lower reranking threshold
// This is VS Code only until we use PSI for JetBrains or build our own general solution
// TODO: Need to pass in the expandSnippet function as a function argument
// because this import causes `tsc` to fail
// if ((await extras.ide.getIdeInfo()).ideType === "vscode") {
//   const { expandSnippet } = await import(
//     "../../../extensions/vscode/src/util/expandSnippet"
//   );
//   let expansionResults = (
//     await Promise.all(
//       extras.selectedCode.map(async (rif) => {
//         return expandSnippet(
//           rif.filepath,
//           rif.range.start.line,
//           rif.range.end.line,
//           extras.ide,
//         );
//       }),
//     )
//   ).flat() as Chunk[];
//   retrievalResults.push(...expansionResults);
// }

// Source: Open file exact match
// Source: Class/function name exact match
