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
      const ide = new ExtensionIde();

      const filesToEmbed = await ide.getFilesToEmbed();
      const total = filesToEmbed.length;
      let done = 1;

      for (let [tag, filepath, hash] of filesToEmbed) {
        const contents = await ide.readFile(filepath);
        const chunks = await chunkDocument(
          filepath,
          contents,
          MAX_CHUNK_SIZE,
          hash
        );
        for await (let chunk of chunks) {
          const [embedding] = await embeddingsProvider.embed([chunk.content]);
          await ide.sendEmbeddingForChunk(chunk, embedding, [tag]);
        }

        done++;
        setProgress(done / (total + 1));
      }
    })();
  }, [embeddingsProvider]);

  return { progress };
}

export default useLoadEmbeddings;
