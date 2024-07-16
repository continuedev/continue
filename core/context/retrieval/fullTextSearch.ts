import { Chunk } from "../../index.js";
import { FullTextSearchCodebaseIndex } from "../../indexing/FullTextSearch.js";
import { RetrievalPipelineRunArguments } from "./pipelines/BaseRetrievalPipeline.js";

export async function retrieveFts(
  args: RetrievalPipelineRunArguments,
  n: number,
): Promise<Chunk[]> {
  const ftsIndex = new FullTextSearchCodebaseIndex();

  let ftsResults: Chunk[] = [];
  try {
    if (args.query.trim() !== "") {
      ftsResults = await ftsIndex.retrieve(
        args.tags,
        args.query
          .trim()
          .split(" ")
          .map((element) => `"${element}"`)
          .join(" OR "),
        n,
        args.filterDirectory,
        undefined,
      );
    }
    return ftsResults;
  } catch (e) {
    console.warn("Error retrieving from FTS:", e);
    return [];
  }
}
