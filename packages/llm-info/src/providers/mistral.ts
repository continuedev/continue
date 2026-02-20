import { ModelProvider } from "../types.js";

export const Mistral: ModelProvider = {
  models: [
    {
      model: "mistral-large-latest",
      displayName: "Mistral Large",
      contextLength: 32768,
      description:
        "Flagship model ideal for complex tasks requiring large reasoning capabilities or highly specialized tasks like synthetic text generation, code generation, RAG, or agents.",
      regex: /mistral-large/i,
      recommendedFor: ["chat"],
    },
    {
      model: "mistral-medium-latest",
      displayName: "Mistral Medium",
      contextLength: 32768,
      description:
        "Ideal for intermediate tasks requiring moderate reasoning such as data extraction, document summarization, email writing, job descriptions, or product descriptions. (Note: Will be deprecated in the coming months)",
      regex: /mistral-medium/i,
    },
    {
      model: "mistral-small-latest",
      displayName: "Mistral Small",
      contextLength: 32768,
      description:
        "Suitable for simple tasks that can be done in bulk like classification, customer support, or text generation.",
      regex: /mistral-small/i,
    },
    {
      model: "open-mistral-7b",
      displayName: "Mistral 7B",
      contextLength: 32768,
      description:
        "First dense model released by Mistral AI, perfect for experimentation, customization, and quick iteration. Matches capabilities of models up to 30B parameters at release time.",
      regex: /open-mistral-7b/i,
    },
    {
      model: "open-mixtral-8x7b",
      displayName: "Mixtral 8x7B",
      contextLength: 32768,
      description:
        "Sparse mixture of experts model leveraging up to 45B parameters but using about 12B during inference, offering better inference throughput at the cost of more vRAM.",
      regex: /open-mixtral-8x7b/i,
    },
    {
      model: "open-mixtral-8x22b",
      displayName: "Mixtral 8x22B",
      contextLength: 65536,
      description:
        "Larger sparse mixture of experts model leveraging up to 141B parameters but using about 39B during inference, providing better inference throughput at the cost of more vRAM.",
      regex: /open-mixtral-8x22b/i,
    },
    {
      model: "mistral-embed",
      displayName: "Mistral Embeddings",
      contextLength: 8192,
      description:
        "Model that converts text into numerical vectors of embeddings in 1024 dimensions. Enables retrieval and retrieval-augmented generation applications with a retrieval score of 55.26 on MTEB.",
      regex: /mistral-embed/i,
      recommendedFor: ["embed"],
    },
    // devstral family
    {
      model: "devstral-small-2505",
      displayName: "Devstral Small",
      contextLength: 128000,
      maxCompletionTokens: 128000,
      description:
        "A small code-focused model from Mistral AI, optimized for development tasks.",
      regex: /devstral-small/i,
      recommendedFor: ["chat"],
    },
    {
      model: "devstral-medium-latest",
      displayName: "Devstral Medium",
      contextLength: 262144,
      maxCompletionTokens: 262144,
      description:
        "A medium-sized code-focused model from Mistral AI with extended context.",
      regex: /devstral-medium/i,
      recommendedFor: ["chat"],
    },
    {
      model: "devstral-2512",
      displayName: "Devstral",
      contextLength: 262144,
      maxCompletionTokens: 262144,
      description:
        "The latest devstral model from Mistral AI for code generation.",
      regex: /^devstral-2512$/i,
      recommendedFor: ["chat"],
    },
    // magistral family
    {
      model: "magistral-medium-latest",
      displayName: "Magistral Medium",
      contextLength: 128000,
      maxCompletionTokens: 16384,
      description:
        "Mistral's reasoning model for complex tasks requiring step-by-step thinking.",
      regex: /magistral-medium/i,
      recommendedFor: ["chat"],
    },
    {
      model: "magistral-small",
      displayName: "Magistral Small",
      contextLength: 128000,
      maxCompletionTokens: 128000,
      description:
        "A smaller reasoning model from Mistral AI for efficient step-by-step thinking.",
      regex: /magistral-small/i,
      recommendedFor: ["chat"],
    },
    // ministral family
    {
      model: "ministral-3b-latest",
      displayName: "Ministral 3B",
      contextLength: 128000,
      maxCompletionTokens: 128000,
      description:
        "Mistral's tiny model for lightweight tasks and edge deployments.",
      regex: /ministral-3b/i,
      recommendedFor: ["chat"],
    },
    {
      model: "ministral-8b-latest",
      displayName: "Ministral 8B",
      contextLength: 128000,
      maxCompletionTokens: 128000,
      description: "Mistral's small model balancing capability and efficiency.",
      regex: /ministral-8b/i,
      recommendedFor: ["chat"],
    },
    // mistral-nemo
    {
      model: "mistral-nemo",
      displayName: "Mistral Nemo",
      contextLength: 128000,
      maxCompletionTokens: 128000,
      description:
        "An open-weight model from Mistral AI and NVIDIA with strong performance.",
      regex: /mistral-nemo/i,
      recommendedFor: ["chat"],
    },
    {
      model: "codestral-mamba-latest",
      displayName: "Codestral Mamba",
      contextLength: 256000,
      description: "A Mamba 2 language model specialized in code generation.",
      regex: /codestral-mamba/i,
    },
    {
      model: "codestral-latest",
      displayName: "Codestral",
      contextLength: 32768,
      description:
        "Cutting-edge generative model specifically designed and optimized for code generation tasks, including fill-in-the-middle and code completion.",
      regex: /codestral/i,
      recommendedFor: ["autocomplete"],
    },
  ],
  id: "mistral",
  displayName: "Mistral",
};
