import { BranchAndDir, Chunk } from "../index.js";
import { FullTextSearchCodebaseIndex } from "../indexing/FullTextSearchCodebaseIndex.js";

export async function fullTextRetrieve(
  prefix: string,
  suffix: string,
  indexTag: BranchAndDir,
): Promise<Chunk[]> {
  const index = new FullTextSearchCodebaseIndex();
  const searchStrings = prefix.split("\n").slice(-3);
  const results: Chunk[] = [];
  searchStrings.forEach(async (searchString) => {
    const chunks = await index.retrieve({
      tags: [indexTag],
      text: searchString,
      n: 3,
    });
    results.push(...chunks);
  });
  return results;
}
