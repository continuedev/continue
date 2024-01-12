import { Chunk } from "core";
import { ExtensionIde } from "core/ide";
import { chunkDocument } from "core/index/chunk/chunk";
import { getBasename } from "core/util";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

const MAX_CHUNK_SIZE = 512;

function useLoadEmbeddings() {
  const [progress, setProgress] = useState(1);
  const [currentlyIndexing, setCurrentlyIndexing] = useState<string | null>(
    null
  );

  const embeddingsProvider = useSelector(
    (store: RootStore) => store.state.config.embeddingsProvider
  );
  const disableIndexing = useSelector(
    (store: RootStore) => store.state.config.disableIndexing
  );

  async function loadEmbeddings() {
    if (!embeddingsProvider || disableIndexing) {
      return;
    }

    const ide = new ExtensionIde();

    const filesToEmbed = await ide.getFilesToEmbed(embeddingsProvider.id);

    const total = filesToEmbed.length + 1;
    let done = 1;

    for (let [tag, filepath, hash] of filesToEmbed) {
      setCurrentlyIndexing(getBasename(filepath));

      try {
        const contents = await ide.readFile(filepath);
        const chunkGenerator = await chunkDocument(
          filepath,
          contents,
          MAX_CHUNK_SIZE,
          hash
        );
        let chunks: Chunk[] = [];
        for await (let chunk of chunkGenerator) {
          chunks.push(chunk);
        }

        if (chunks.length === 0) {
          done++;
          setProgress(done / total);
          continue;
        }

        const embeddings = await embeddingsProvider.embed(
          chunks.map((c) => c.content)
        );

        for (let i = 0; i < chunks.length; i++) {
          await ide.sendEmbeddingForChunk(chunks[i], embeddings[i], [tag]);
        }
      } catch (e) {
        console.warn(`Failed to embed ${filepath}`, e);
      }

      done++;
      setProgress(done / total);
    }
  }

  useEffect(() => {
    const eventListener = (event: any) => {
      if (event.data.type === "updateEmbeddings") {
        loadEmbeddings();
      }
    };
    window.addEventListener("message", eventListener);
    return () => window.removeEventListener("message", eventListener);
  }, [embeddingsProvider, disableIndexing]);

  useEffect(() => {
    loadEmbeddings();
  }, [embeddingsProvider, disableIndexing]);

  return { progress, currentlyIndexing };
}

export default useLoadEmbeddings;
