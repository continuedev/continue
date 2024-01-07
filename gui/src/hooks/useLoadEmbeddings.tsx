import { ExtensionIde } from "core/ide";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

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

      for (let [filepath, hash] of filesToEmbed) {
        const contents = await ide.readFile(filepath);
        const chunks = await chunkFile(contents);
        const embeddings = await embeddingsProvider.embed(chunks);
        for (let i = 0; i < chunks.length; i++) {
          await ide.sendChunkForFile(hash, embeddings[i], i);
        }

        done++;
        setProgress(done / (total + 1));
      }
    })();
  }, [embeddingsProvider]);

  return { progress };
}

export default useLoadEmbeddings;
