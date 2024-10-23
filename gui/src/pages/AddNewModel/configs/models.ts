import { ILLM, ModelProvider } from "core";
import { InputDescriptor } from "./providers";
import { ModelProviderTags } from "../../../components/modelSelection/utils";

// A dimension is like parameter count - 7b, 13b, 34b, etc.
// You would set options to the field that should be changed for that option in the params field of ModelPackage
export interface PackageDimension {
  name: string;
  description: string;
  options: { [key: string]: { [key: string]: any } };
}
export interface ModelPackage {
  title: string;
  icon?: string;
  collectInputFor?: InputDescriptor[];
  description: string;
  refUrl?: string;
  tags?: ModelProviderTags[];
  params: {
    model: ILLM["model"];
    templateMessages?: ILLM["templateMessages"];
    contextLength: ILLM["contextLength"];
    stopTokens?: string[];
    promptTemplates?: ILLM["promptTemplates"];
    replace?: [string, string][];
    [key: string]: any;
  };
  dimensions?: PackageDimension[];
  providerOptions?: ModelProvider[];
  isOpenSource: boolean;
}

export const models: { [key: string]: ModelPackage } = {
  llama31Chat: {
    title: "Llama3.1 Chat",
    description: "The latest model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-8b",
      model: "llama3.1-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "llama3.1-8b",
            title: "Llama3.1-8b",
          },
          "70b": {
            model: "llama3.1-70b",
            title: "Llama3.1-70b",
          },
          "405b": {
            model: "llama3.1-405b",
            title: "Llama3.1-405b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
      "sambanova",
      "cerebras",
    ],
    isOpenSource: true,
  },
  deepseek: {
    title: "DeepSeek Coder",
    description:
      "A model pre-trained on 2 trillion tokens including 80+ programming languages and a repo-level corpus.",
    params: {
      title: "DeepSeek-7b",
      model: "deepseek-7b",
      contextLength: 4096,
    },
    icon: "deepseek.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "1b": {
            model: "deepseek-1b",
            title: "DeepSeek-1b",
          },
          "7b": {
            model: "deepseek-7b",
            title: "DeepSeek-7b",
          },
          "33b": {
            model: "deepseek-33b",
            title: "DeepSeek-33b",
          },
        },
      },
    ],
    providerOptions: ["ollama", "lmstudio", "llama.cpp"],
    isOpenSource: true,
  },
  deepseekChatApi: {
    title: "DeepSeek Chat",
    description: "DeepSeek's best model for general chat use cases.",
    params: {
      title: "DeepSeek Chat",
      model: "deepseek-chat",
      contextLength: 128_000,
    },
    icon: "deepseek.png",
    providerOptions: ["deepseek"],
    isOpenSource: false,
  },
  deepseekCoderApi: {
    title: "DeepSeek Coder",
    description:
      "A model pre-trained on 2 trillion tokens including 80+ programming languages and a repo-level corpus.",
    params: {
      title: "DeepSeek Coder",
      model: "deepseek-coder",
      contextLength: 128_000,
    },
    icon: "deepseek.png",
    providerOptions: ["deepseek"],
    isOpenSource: false,
  },
  mistralOs: {
    title: "Mistral",
    description:
      "A series of open-weight models created by Mistral AI, highly competent for code generation and other tasks",
    params: {
      title: "Mistral",
      model: "mistral-7b",
      contextLength: 4096,
    },
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "mistral-7b",
            title: "Mistral-7b",
          },
          "8x7b (MoE)": {
            model: "mistral-8x7b",
            title: "Mixtral",
          },
        },
      },
    ],
    icon: "mistral.png",
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
    ],
    isOpenSource: true,
  },
  codeLlamaInstruct: {
    title: "CodeLlama Instruct",
    description:
      "A model from Meta, fine-tuned for code generation and conversation",
    refUrl: "",
    params: {
      title: "CodeLlama-7b",
      model: "codellama-7b",
      contextLength: 4096,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "codellama-7b",
            title: "CodeLlama-7b",
          },
          "13b": {
            model: "codellama-13b",
            title: "CodeLlama-13b",
          },
          "34b": {
            model: "codellama-34b",
            title: "CodeLlama-34b",
          },
          "70b": {
            model: "codellama-70b",
            title: "Codellama-70b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
    ],
    isOpenSource: true,
  },
  llama3170bTrial: {
    title: "Codellama 70b (Free Trial)",
    description:
      "The best code model from Meta, fine-tuned for code generation and conversation",
    refUrl: "",
    params: {
      title: "CodeLlama-70b",
      model: "codellama-70b",
      contextLength: 4096,
    },
    icon: "meta.png",
    providerOptions: ["free-trial"],
    isOpenSource: false,
  },
  llama31405bTrial: {
    title: "Llama3.1 405b (Free Trial)",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-405b",
      model: "llama3.1-405b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["free-trial"],
    isOpenSource: false,
  },
  mixtralTrial: {
    title: "Mixtral (Free Trial)",
    description:
      "Mixtral 8x7b is a mixture of experts model created by Mistral AI",
    refUrl: "",
    params: {
      title: "Mixtral",
      model: "mistral-8x7b",
      contextLength: 4096,
    },
    icon: "mistral.png",
    providerOptions: ["free-trial", "groq"],
    isOpenSource: false,
  },
  llama38bChat: {
    title: "Llama3 8b",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-8b",
      model: "llama3-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama370bChat: {
    title: "Llama3 70b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-70b",
      model: "llama3-70b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama318bChat: {
    title: "Llama3.1 8b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-8b",
      model: "llama3.1-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama3170bChat: {
    title: "Llama3.1 70b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-70b",
      model: "llama3.1-70b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama31405bChat: {
    title: "Llama3.1 405b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-405b",
      model: "llama3.1-405b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama270bChat: {
    title: "Llama2 70b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama2-70b",
      model: "llama2-70b",
      contextLength: 4096,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama3Chat: {
    title: "Llama3 Chat",
    description: "The latest model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-8b",
      model: "llama3-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "llama3-8b",
            title: "Llama3-8b",
          },
          "70b": {
            model: "llama3-70b",
            title: "Llama3-70b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
    ],
    isOpenSource: true,
  },
  graniteCodeOpenSource: {
    title: "Granite Code",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "granite-code",
      contextLength: 20_000,
      title: "Granite Code",
      systemMessage: `You are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'day, morning, afternoon, evening, night, what's up, nice to meet you, sup, etc) with "Hello! I am Granite Chat, created by IBM. How can I help you today?". Please do not say anything else and do not start a conversation.`,
    },
    providerOptions: ["ollama", "lmstudio", "llama.cpp", "replicate"],
    icon: "ibm.png",
    isOpenSource: true,
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "3b": {
            model: "granite-code-3b",
            title: "Granite Code 3B",
          },
          "8b": {
            model: "granite-code-8b",
            title: "Granite Code 8B",
          },
          "20b": {
            model: "granite-code-20b",
            title: "Granite Code 20B",
          },
          "34b": {
            model: "granite-code-34b",
            title: "Granite Code 34B",
          },
        },
      },
    ],
  },
  wizardCoder: {
    title: "WizardCoder",
    description:
      "A CodeLlama-based code generation model from WizardLM, focused on Python",
    refUrl: "",
    params: {
      title: "WizardCoder-7b",
      model: "wizardcoder-7b",
      contextLength: 4096,
    },
    icon: "wizardlm.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "wizardcoder-7b",
            title: "WizardCoder-7b",
          },
          "13b": {
            model: "wizardcoder-13b",
            title: "WizardCoder-13b",
          },
          "34b": {
            model: "wizardcoder-34b",
            title: "WizardCoder-34b",
          },
        },
      },
    ],
    providerOptions: ["ollama", "lmstudio", "llama.cpp", "replicate"],
    isOpenSource: true,
  },
  phindCodeLlama: {
    title: "Phind CodeLlama (34b)",
    description: "A finetune of CodeLlama by Phind",
    icon: "meta.png",
    params: {
      title: "Phind CodeLlama",
      model: "phind-codellama-34b",
      contextLength: 4096,
    },
    providerOptions: [
      "ollama",
      "lmstudio",
      "llama.cpp",
      "replicate",
      "free-trial",
    ],
    isOpenSource: true,
  },
  codestral: {
    title: "Codestral",
    description:
      "Codestral is an advanced generative model created by Mistral AI, tailored for coding tasks like fill-in-the-middle and code completion.",
    params: {
      title: "Codestral",
      model: "codestral-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: true,
  },
  codestralMamba: {
    title: "Codestral Mamba",
    description: "A Mamba 2 language model specialized in code generation.",
    params: {
      title: "Codestral Mamba",
      model: "codestral-mamba-latest",
      contextLength: 256_000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: true,
  },
  mistral7b: {
    title: "Mistral 7B",
    description:
      "The first dense model released by Mistral AI, perfect for experimentation, customization, and quick iteration. At the time of the release, it matched the capabilities of models up to 30B parameters.",
    params: {
      title: "Mistral 7B",
      model: "open-mistral-7b",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistral8x7b: {
    title: "Mixtral 8x7B",
    description:
      "A sparse mixture of experts model. As such, it leverages up to 45B parameters but only uses about 12B during inference, leading to better inference throughput at the cost of more vRAM.",
    params: {
      title: "Mixtral 8x7B",
      model: "open-mixtral-8x7b",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistral8x22b: {
    title: "Mistral 8x22B",
    description:
      "A bigger sparse mixture of experts model. As such, it leverages up to 141B parameters but only uses about 39B during inference, leading to better inference throughput at the cost of more vRAM.",
    params: {
      title: "Mistral 8x22B",
      model: "open-mixtral-8x22b",
      contextLength: 64000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistralSmall: {
    title: "Mistral Small",
    description:
      "Suitable for simple tasks that one can do in bulk (Classification, Customer Support, or Text Generation)",
    params: {
      title: "Mistral Small",
      model: "mistral-small-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistralLarge: {
    title: "Mistral Large",
    description:
      "Mistral's flagship model that's ideal for complex tasks that require large reasoning capabilities or are highly specialized (Synthetic Text Generation, Code Generation, RAG, or Agents).",
    params: {
      title: "Mistral Large",
      model: "mistral-large-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  geminiPro: {
    title: "Gemini Pro",
    description: "A highly capable model created by Google DeepMind",
    params: {
      title: "Gemini Pro",
      model: "gemini-pro",
      contextLength: 32_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini15Pro: {
    title: "Gemini 1.5 Pro",
    description: "A newer Gemini model with 1M token context length",
    params: {
      title: "Gemini 1.5 Pro",
      model: "gemini-1.5-pro-latest",
      contextLength: 2_000_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini", "free-trial"],
    isOpenSource: false,
  },
  gemini15Flash: {
    title: "Gemini 1.5 Flash",
    description:
      "Fast and versatile multimodal model for scaling across diverse tasks",
    params: {
      title: "Gemini 1.5 Flash",
      model: "gemini-1.5-flash-latest",
      contextLength: 1_000_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  commandR: {
    title: "Command R",
    description:
      "Command R is a scalable generative model targeting RAG and Tool Use to enable production-scale AI for enterprise.",
    params: {
      model: "command-r",
      contextLength: 128_000,
      title: "Command R",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandRPlus: {
    title: "Command R+",
    description:
      "Command R+ is a state-of-the-art RAG-optimized model designed to tackle enterprise-grade workloads",
    params: {
      model: "command-r-plus",
      contextLength: 128_000,
      title: "Command R+",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  gpt4turbo: {
    title: "GPT-4 Turbo",
    description:
      "A faster and more capable version of GPT-4 with longer context length and image support",
    params: {
      model: "gpt-4-turbo",
      contextLength: 128_000,
      title: "GPT-4 Turbo",
    },
    providerOptions: ["openai"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt4o: {
    title: "GPT-4o",
    description:
      "An even faster version of GPT-4 with stronger multi-modal capabilities.",
    params: {
      model: "gpt-4o",
      contextLength: 128_000,
      title: "GPT-4o",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["openai", "free-trial"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt4omini: {
    title: "GPT-4o Mini",
    description:
      "A model at less than half the price of gpt-3.5-turbo, but near gpt-4 in capabilities.",
    params: {
      model: "gpt-4o-mini",
      contextLength: 128_000,
      title: "GPT-4o mini",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["openai"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt35turbo: {
    title: "GPT-3.5-Turbo",
    description:
      "A faster, cheaper OpenAI model with slightly lower capabilities",
    params: {
      model: "gpt-3.5-turbo",
      contextLength: 8096,
      title: "GPT-3.5-Turbo",
    },
    providerOptions: ["openai", "free-trial"],
    icon: "openai.png",
    isOpenSource: false,
  },
  claude35Sonnet: {
    title: "Claude 3.5 Sonnet",
    description:
      "Anthropic's most intelligent model, but much less expensive than Claude 3 Opus",
    params: {
      model: "claude-3-5-sonnet-20240620",
      contextLength: 200_000,
      title: "Claude 3.5 Sonnet",
      apiKey: "",
    },
    providerOptions: ["anthropic", "free-trial"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude3Opus: {
    title: "Claude 3 Opus",
    description:
      "The most capable model in the Claude 3 series, beating GPT-4 on many benchmarks",
    params: {
      model: "claude-3-opus-20240229",
      contextLength: 200_000,
      title: "Claude 3 Opus",
      apiKey: "",
    },
    providerOptions: ["anthropic"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude3Sonnet: {
    title: "Claude 3 Sonnet",
    description:
      "The second most capable model in the Claude 3 series: ideal balance of intelligence and speed",
    params: {
      model: "claude-3-sonnet-20240229",
      contextLength: 200_000,
      title: "Claude 3 Sonnet",
      apiKey: "",
    },
    providerOptions: ["anthropic", "free-trial"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude3Haiku: {
    title: "Claude 3 Haiku",
    description:
      "The third most capable model in the Claude 3 series: fastest and most compact model for near-instant responsiveness",
    params: {
      model: "claude-3-haiku-20240307",
      contextLength: 200_000,
      title: "Claude 3 Haiku",
      apiKey: "",
    },
    providerOptions: ["anthropic", "free-trial"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  graniteChat: {
    title: "watsonx - Granite Chat",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-13b-chat-v2",
      contextLength: 20_000,
      title: "Granite Chat",
    },
    providerOptions: ["watsonx"],
    icon: "",
    isOpenSource: false,
  },
  graniteCode: {
    title: "watsonx - Granite Code 20b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-20b-code-instruct",
      contextLength: 20_000,
      title: "watsonx - Granite Code 20b",
    },
    providerOptions: ["watsonx"],
    icon: "watsonx.png",
    isOpenSource: false,
  },
  MistralLarge: {
    title: "watsonx - Mistral Large",
    description:
      "Mistral Large, the most advanced Large Language Model (LLM) developed by Mistral Al, is an exceptionally powerful model.",
    params: {
      model: "mistralai/mistral-large",
      contextLength: 20_000,
      title: "watsonx - Mistral Large",
    },
    providerOptions: ["watsonx"],
    icon: "mistral.png",
    isOpenSource: false,
  },
  NotDiamond: {
    title: "Not Diamond",
    description:
      "Not Diamond is an AI model router that determines which LLM is best-suited to respond.",
    params: {
      title: "Not Diamond",
      model: "notdiamond/notdiamond",
      contextLength: 200_000,
    },
    icon: "notdiamond.png",
    dimensions: [],
    providerOptions: ["notdiamond"],
    isOpenSource: true,
  },
  MetaLlama3: {
    title: "watsonx - Llama 3.1",
    description:
      "Llama 3 is an auto-regressive language model that uses an optimized transformer architecture.",
    params: {
      title: "watsonx - Llama 3.1 8b",
      model: "meta-llama/llama-3-1-8b-instruct",
      contextLength: 20_000,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "meta-llama/llama-3-1-8b-instruct",
            title: "watsonx - Llama 3.1 8b",
          },
          "70b": {
            model: "meta-llama/llama-3-1-70b-instruct",
            title: "watsonx - Llama 3.1 70b",
          },
        },
      },
    ],
    providerOptions: ["watsonx"],
    isOpenSource: false,
  },
  AUTODETECT: {
    title: "Autodetect",
    description:
      "Automatically populate the model list by calling the /models endpoint of the server",
    params: {
      model: "AUTODETECT",
    } as any,
    providerOptions: [],
    isOpenSource: false,
  },
};
