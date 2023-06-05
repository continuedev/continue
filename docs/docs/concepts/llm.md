# LLM

**TODO: Better explain in one sentence what this is and what its purpose is**

:::info
An **LLM** is short for Large Language Model, which includes models like GPT-4, StarCoder, and others
:::

## Details

Just a class with a "complete" method. Right now have HuggingFaceInferenceAPI and OpenAI subclasses. Need credentials as of now. Different models useful in different places, so we provide easy access to multiple of them, right now just gpt3.5 and starcoder, but can add others super easily.

- `LLM` is the large language model that can be used in steps to automate that require some judgement based on context (e.g. generating code based on docs, explaining an error given a stack trace, etc)
- Steps and recipes are implemented with specific models
- Need to credentials for OpenAI models

## Supported Models

### `gpt-4`

### `gpt-3.5-turbo`

### `StarCoder`
