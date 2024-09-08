---
title: Custom
---

If you have your own API capable of generating embeddings, Continue makes it easy to write a custom `EmbeddingsProvider`. All you have to do is write a function that converts strings to arrays of numbers, and add this to your config in `config.ts`. Here's an example:

```ts title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.embeddingsProvider = {
    embed: (chunks: string[]) => {
      return Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch("https://example.com/embeddings", {
            method: "POST",
            body: JSON.stringify({ text: chunk }),
          });
          const data = await response.json();
          return data.embedding;
        }),
      );
    },
  };

  return config;
}
```
