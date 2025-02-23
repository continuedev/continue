# @continuedev/llm-info

A lightweight package providing information about various Large Language Models (LLMs), including embedding, reranking, and other models.

Whereas @continuedev/openai-adapters is responsible for translation between API types, @continuedev/llm-info is concerned with

- Templates
- Capabilities (e.g. tools, images, streaming, predicted outputs, etc.)
- Model aliases

and openai-adapters might depend on llm-info for some of these things.

### Goal

We know we are done when the steps required to add support for a new model in Continue are exactly

1. editing a single LlmInfo object, and
2. adding it to the supporting ModelProviders.

### Code structure

The two primary types are LlmInfo and ModelProvider

Models are defined on their own in the `models` directory. They can be grouped however makes sense.

Providers are defined in the `providers` directory, with all models that they support in their `models` attribute. It's important that models are tied to providers, because the model might have slightly different attributes (e.g. context length) per provider. Define as much as possible in the base object, and then spread to update for the specific providers as needed.

### Where to use llm-info

- Replace autodetect.ts
- See usage in `BaseLLM` constructor, and finish the job of using llm-info everywhere relevant.
- Replace `gui/pages/AddNewModel/configs/[providers/models].ts`
