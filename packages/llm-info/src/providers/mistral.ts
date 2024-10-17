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
