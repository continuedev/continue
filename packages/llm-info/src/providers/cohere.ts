import { ModelProvider } from "../types.js";

export const Cohere: ModelProvider = {
  models: [
    {
      model: "command-a-translate-08-2025",
      displayName: "Command A Translate 08-2025",
      contextLength: 8000,
      maxCompletionTokens: 8192,
      description:
        "Command A Translate is Cohere’s state of the art machine translation model, excelling at a variety of translation tasks on 23 languages",
      recommendedFor: ["chat"],
    },
    {
      model: "command-a-reasoning-08-2025",
      displayName: "Command A Reasoning 08-2025",
      contextLength: 256000,
      maxCompletionTokens: 32768,
      description:
        "Command A Reasoning is Cohere’s first reasoning model, able to ‘think’ before generating an output in a way that allows it to perform well in certain kinds of nuanced problem-solving and agent-based tasks in 23 languages.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-a-vision-07-2025",
      displayName: "Command A Vision 07-2025",
      contextLength: 128000,
      maxCompletionTokens: 8192,
      description:
        "Command A Vision is Cohere's first model capable of processing images, excelling in enterprise use cases such as analyzing charts, graphs, and diagrams, table understanding, OCR, document Q&A, and object detection.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-a-03-2025",
      displayName: "Command A 03-2025",
      contextLength: 256000,
      maxCompletionTokens: 8192,
      description:
        "Command A is Cohere’s most performant model to date, excelling at real world enterprise tasks including tool use, retrieval augmented generation (RAG), agents, and multilingual use cases.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r7b-arabic-12-2024",
      displayName: "Command R7B Arabic 02-2025",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Our state-of-the-art lightweight multilingual AI model has been optimized for advanced Arabic language capabilities to support enterprises in the MENA region.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r7b-12-2024",
      displayName: "Command R7B 12-2024",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "The smallest model in our R series delivers top-tier speed, efficiency, and quality to build powerful AI applications on commodity GPUs and edge devices.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r-plus-08-2024",
      displayName: "Command R+ 08-2024",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Command R is a scalable generative model targeting RAG and Tool Use to enable production-scale AI for enterprise.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r-08-2024",
      displayName: "Command R 08-2024",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Command R+ is a state-of-the-art RAG-optimized model designed to tackle enterprise-grade workloads.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r-plus-04-2024",
      displayName: "Command R+ 04-2024",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Command R is a scalable generative model targeting RAG and Tool Use to enable production-scale AI for enterprise.",
      recommendedFor: ["chat"],
    },
    {
      model: "command-r-03-2024",
      displayName: "Command R 03-2024",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Command R+ is a state-of-the-art RAG-optimized model designed to tackle enterprise-grade workloads.",
      recommendedFor: ["chat"],
    },
    {
      model: "c4ai-aya-vision-32b",
      displayName: "C4AI Aya Vision 32B",
      contextLength: 16000,
      maxCompletionTokens: 4096,
      description:
        "Aya Vision is a state-of-the-art multimodal and massively multilingual large language model excelling at critical benchmarks for language, text, and image capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "c4ai-aya-vision-8b",
      displayName: "C4AI Aya Vision 8B",
      contextLength: 16000,
      maxCompletionTokens: 4096,
      description:
        "Aya Vision is a state-of-the-art multimodal and massively multilingual large language model excelling at critical benchmarks for language, text, and image capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "c4ai-aya-expanse-32b",
      displayName: "C4AI Aya Expanse 32B",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Aya Expanse is a massively multilingual large language model excelling in enterprise-scale tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "c4ai-aya-expanse-8b",
      displayName: "C4AI Aya Expanse 8B",
      contextLength: 8000,
      maxCompletionTokens: 4096,
      description:
        "Aya Expanse is a massively multilingual large language model excelling in enterprise-scale tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "embed-v4.0",
      displayName: "Embed v4.0",
      description:
        "A model that allows for text and images to be classified or turned into embeddings.",
      recommendedFor: ["embed"],
      contextLength: 128000,
    },
    {
      model: "embed-english-v3.0",
      displayName: "Embed English v3.0",
      description:
        "A model that allows for text to be classified or turned into embeddings. English only.",
      recommendedFor: ["embed"],
      contextLength: 512,
    },
    {
      model: "embed-english-light-v3.0",
      displayName: "Embed English Light v3.0",
      description:
        "A smaller, faster version of embed-english-v3.0. Almost as capable, but a lot faster. English only.",
      recommendedFor: ["embed"],
      contextLength: 512,
    },
    {
      model: "embed-multilingual-v3.0",
      displayName: "Embed Multilingual v3.0",
      description:
        "Provides multilingual classification and embedding support.",
      recommendedFor: ["embed"],
      contextLength: 512,
    },
    {
      model: "embed-multilingual-light-v3.0",
      displayName: "Embed Multilingual Light v3.0",
      description:
        "A smaller, faster version of embed-multilingual-v3.0. Almost as capable, but a lot faster.",
      recommendedFor: ["embed"],
      contextLength: 512,
    },
    {
      model: "rerank-v3.5",
      displayName: "Rerank v3.5",
      description:
        "A model for documents and semi-structured data (JSON). State-of-the-art performance in English and non-English languages.",
      recommendedFor: ["rerank"],
      contextLength: 4096,
    },
    {
      model: "rerank-english-v3.0",
      displayName: "Rerank English v3.0",
      description:
        "A model that allows for re-ranking English Language documents and semi-structured data (JSON).",
      recommendedFor: ["rerank"],
      contextLength: 4096,
    },
    {
      model: "rerank-multilingual-v3.0",
      displayName: "Rerank Multilingual v3.0",
      description:
        "A model for documents and semi-structure data (JSON) that are not in English.",
      recommendedFor: ["rerank"],
      contextLength: 4096,
    },
  ],
  id: "cohere",
  displayName: "Cohere",
};
