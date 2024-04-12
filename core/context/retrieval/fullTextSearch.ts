import { BranchAndDir, Chunk } from "../..";
import { FullTextSearchCodebaseIndex } from "../../indexing/FullTextSearch";
export async function retrieveFts(
  query: string,
  n: number,
  tags: BranchAndDir[],
  filterDirectory: string | undefined,
): Promise<Chunk[]> {
  const ftsIndex = new FullTextSearchCodebaseIndex();

  let ftsResults: Chunk[] = [];
  try {
    if (query.trim() !== "") {
      ftsResults = await ftsIndex.retrieve(
        tags,
        query
          .trim()
          .split(" ")
          .map((element) => `"${element}"`)
          .join(" OR "),
        n,
        filterDirectory,
        undefined,
      );
    }
    return ftsResults;
  } catch (e) {
    console.warn("Error retrieving from FTS:", e);
    return [];
  }
}
