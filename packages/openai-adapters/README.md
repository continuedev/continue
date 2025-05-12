# OpenAI Adapters

OpenAI adapters convert an OpenAI-compatible request to a request for another API and back.

They are purely a translation layer, and are not concerned with:

- Templates
- Whether a model supports tools, images, etc.
- Dynamically changing API base for model
- Keeping track of system message (it will always be the first message with a systemMesage)
- Keeping a private variable with anything that is already passed through the OpenAI request body
- Appending "/" to the apiBase (but this is TODO)
- Batching embeddings (yes, it requires some knowledge of max batch size, but it's more important to maintain 1 req = 1 req)
- Using streamChat for streamComplete and vice-versa if one isn't defined

The goal is for this to change as infrequently as possible. It should only require updating when the actual API format changes.

They are concerned with:

- Converting model aliases
- Cache behavior
- max stop words
- use legacy completions endpoint?
- anything else that couldn't possibly be guess by the client since it won't know the endpoint behind the proxy

## Supported APIs

- [x] Anthropic
- [ ] AskSage
- [x] Azure
- [ ] Bedrock
- [ ] Bedrock Import
- [x] Cerebras
- [ ] Cloudflare
- [x] Cohere
- [x] DeepInfra
- [x] Deepseek
- [ ] Flowise
- [x] Function Network
- [x] Gemini
- [x] Groq
- [ ] HuggingFace Inference API
- [ ] HuggingFace TGI
- [x] Kindo
- [x] LMStudio
- [x] LlamaCpp
- [x] Llamafile
- [x] Msty
- [x] Mistral
- [x] Nvidia
- [x] Nebius
- [x] OpenRouter
- [x] OpenAI
- [ ] !Ollama
- [x] OVHCLoud
- [ ] Replicate
- [ ] SageMaker
- [x] SambaNova
- [x] Scaleway
- [ ] Silicon Flow
- [x] TextGen Web UI
- [x] Together
- [x] Novita AI
- [x] Vllm
- [ ] Vertex AI
- [x] Voyage AI
- [ ] WatsonX
- [x] xAI
- [x] Fireworks
- [x] Moonshot
