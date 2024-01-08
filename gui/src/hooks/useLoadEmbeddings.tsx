import { ExtensionIde } from "core/ide";
import { chunkDocument } from "core/index/chunk/chunk";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

const MAX_CHUNK_SIZE = 512;

function useLoadEmbeddings() {
  const [progress, setProgress] = useState(0);
  const embeddingsProvider = useSelector(
    (store: RootStore) => store.state.config.embeddingsProvider
  );

  useEffect(() => {
    (async () => {
      if (!embeddingsProvider) {
        return;
      }

      const ide = new ExtensionIde();

      const filesToEmbed = await ide.getFilesToEmbed();
      console.log("Files to embed", filesToEmbed);

      const total = filesToEmbed.length + 1;
      let done = 1;
      setProgress(done / total);

      for (let [tag, filepath, hash] of filesToEmbed) {
        try {
          console.log(`Embedding ${filepath}`);
          const contents = await ide.readFile(filepath);
          const chunks = await chunkDocument(
            filepath,
            contents,
            MAX_CHUNK_SIZE,
            hash
          );
          for await (let chunk of chunks) {
            const [embedding] = await embeddingsProvider.embed([chunk.content]);
            console.log("Embedding: ", embedding);
            await ide.sendEmbeddingForChunk(chunk, embedding, [tag]);
          }
        } catch (e) {
          console.warn(`Failed to embed ${filepath}`, e);
        }

        done++;
        setProgress(done / total);
      }
    })();
  }, [embeddingsProvider]);

  return { progress };
}

export default useLoadEmbeddings;
