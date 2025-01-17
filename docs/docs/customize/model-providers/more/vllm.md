# vLLM

vLLM is an open-source library for fast LLM inference which typically is used to serve multiple users at the same. It can also be used to run a large model on multiple GPU:s (e.g. when it doesn´t fit in a single GPU). Run their OpenAI-compatible server using `vllm serve`. See their [server documentation](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html) and the [engine arguments documentation](https://docs.vllm.ai/en/latest/usage/engine_args.html).

```shell
vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct
```
## Chat model

We recommend configuring **Llama3.1 8B** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Llama3.1 8B Instruct",
      "provider": "vllm",
      "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "apiBase": "http://<vllm chat endpoint>/v1"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **Qwen2.5-Coder 1.5B** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 1.5B",
    "provider": "vllm",
    "model": "Qwen/Qwen2.5-Coder-1.5B"
    "apiBase": "http://<vllm autocomplete endpoint>/v1"
  }
}
```

## Embeddings model

We recommend configuring **Nomic Embed Text** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "vllm",
    "model": "nomic-ai/nomic-embed-text-v1"
    "apiBase": "http://<vllm embed endpoint>/v1"
  }
}
```

## Reranking model

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.


The continue implementation uses [OpenAI](../top-level/openai.md) under the hood. [View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Vllm.ts)
