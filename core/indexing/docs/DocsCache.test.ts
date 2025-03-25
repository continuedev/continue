import OpenAI from "../../llm/llms/OpenAI";
import { DocsCache } from "./DocsCache"; // adjust import path as needed

describe("DocsCache", () => {
  let openAIEmbeddings: OpenAI;

  beforeAll(() => {
    openAIEmbeddings = new OpenAI({
      apiKey: "",
      model: "text-embedding-ada-002",
    });
  });

  test("normalizeEmbeddingId() produces a valid ID without constructor name", async () => {
    // Get the embedding ID from OpenAI embeddings provider
    const embeddingId = DocsCache.normalizeEmbeddingId(
      openAIEmbeddings.embeddingId,
    );

    // The ID should not contain the constructor name (OpenAI)
    expect(embeddingId).toEqual(
      `${openAIEmbeddings.model}::${openAIEmbeddings.maxEmbeddingChunkSize}`,
    );
  });
});
