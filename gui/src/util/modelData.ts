/*
This is the data that populates the model selection page.
*/

import { ModelName, ModelProvider } from "core";
import _ from "lodash";

export function updatedObj(old: any, pathToValue: { [key: string]: any }) {
  const newObject = _.cloneDeep(old);
  for (const key in pathToValue) {
    if (typeof pathToValue[key] === "function") {
      _.updateWith(newObject, key, pathToValue[key]);
    } else {
      _.updateWith(newObject, key, (__) => pathToValue[key]);
    }
  }
  return newObject;
}

export enum ModelProviderTag {
  "Requires API Key" = "Requires API Key",
  "Local" = "Local",
  "Free" = "Free",
  "Open-Source" = "Open-Source",
}

export const MODEL_PROVIDER_TAG_COLORS: any = {};
MODEL_PROVIDER_TAG_COLORS[ModelProviderTag["Requires API Key"]] = "#FF0000";
MODEL_PROVIDER_TAG_COLORS[ModelProviderTag["Local"]] = "#00bb00";
MODEL_PROVIDER_TAG_COLORS[ModelProviderTag["Open-Source"]] = "#0033FF";
MODEL_PROVIDER_TAG_COLORS[ModelProviderTag["Free"]] = "#ffff00";

export enum CollectInputType {
  "text" = "text",
  "number" = "number",
  "range" = "range",
}

export interface InputDescriptor {
  inputType: CollectInputType;
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  required?: boolean;
  description?: string;
  [key: string]: any;
}

const contextLengthInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "contextLength",
  label: "Context Length",
  defaultValue: undefined,
  required: false,
};
const temperatureInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "completionOptions.temperature",
  label: "Temperature",
  defaultValue: undefined,
  required: false,
  min: 0.0,
  max: 1.0,
  step: 0.01,
};
const topPInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "completionOptions.topP",
  label: "Top-P",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};
const topKInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "completionOptions.topK",
  label: "Top-K",
  defaultValue: undefined,
  required: false,
  min: 0,
  step: 1,
};
const presencePenaltyInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "completionOptions.presencePenalty",
  label: "Presence Penalty",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};
const FrequencyPenaltyInput: InputDescriptor = {
  inputType: CollectInputType.number,
  key: "completionOptions.frequencyPenalty",
  label: "Frequency Penalty",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};
const completionParamsInputs = [
  contextLengthInput,
  temperatureInput,
  topKInput,
  topPInput,
  presencePenaltyInput,
  FrequencyPenaltyInput,
];

const apiBaseInput: InputDescriptor = {
  inputType: CollectInputType.text,
  key: "apiBase",
  label: "API Base",
  placeholder: "e.g. http://localhost:8080",
  required: false,
};

export interface ModelInfo {
  title: string;
  provider: ModelProvider;
  description: string;
  longDescription?: string;
  icon?: string;
  tags?: ModelProviderTag[];
  packages: ModelPackage[];
  params?: any;
  collectInputFor?: InputDescriptor[];
  refPage?: string;
}

// A dimension is like parameter count - 7b, 13b, 34b, etc.
// You would set options to the field that should be changed for that option in the params field of ModelPackage
export interface PackageDimension {
  name: string;
  description: string;
  options: { [key: string]: { [key: string]: any } };
}

export interface ModelPackage {
  collectInputFor?: InputDescriptor[];
  description: string;
  title: string;
  refUrl?: string;
  tags?: ModelProviderTag[];
  icon?: string;
  params: {
    model: ModelName;
    templateMessages?: string;
    contextLength: number;
    stopTokens?: string[];
    promptTemplates?: any;
    replace?: [string, string][];
    [key: string]: any;
  };
  dimensions?: PackageDimension[];
  providerOptions?: string[];
}

const codeLlamaInstruct: ModelPackage = {
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
  providerOptions: ["ollama", "lmstudio", "together", "llamacpp", "replicate"],
};

const codellama70bTrial: ModelPackage = {
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
  providerOptions: ["freetrial"],
};

const mixtralTrial: ModelPackage = {
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
  providerOptions: ["freetrial", "groq"],
};

const llama270bChat: ModelPackage = {
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
};

const llama2Chat: ModelPackage = {
  title: "Llama2 Chat",
  description: "The latest Llama model from Meta, fine-tuned for chat",
  refUrl: "",
  params: {
    title: "Llama2-7b",
    model: "llama2-7b",
    contextLength: 4096,
  },
  icon: "meta.png",
  dimensions: [
    {
      name: "Parameter Count",
      description: "The number of parameters in the model",
      options: {
        "7b": {
          model: "llama2-7b",
          title: "Llama2-7b",
        },
        "13b": {
          model: "llama2-13b",
          title: "Llama2-13b",
        },
        "34b": {
          model: "llama2-34b",
          title: "Llama2-34b",
        },
      },
    },
  ],
  providerOptions: ["ollama", "lmstudio", "together", "llamacpp", "replicate"],
};

const wizardCoder: ModelPackage = {
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
  providerOptions: ["ollama", "lmstudio", "llamacpp", "replicate"],
};

const phindCodeLlama: ModelPackage = {
  title: "Phind CodeLlama (34b)",
  description: "A finetune of CodeLlama by Phind",
  icon: "meta.png",
  params: {
    title: "Phind CodeLlama",
    model: "phind-codellama-34b",
    contextLength: 4096,
  },
  providerOptions: ["ollama", "lmstudio", "llamacpp", "replicate", "freetrial"],
};

const mistral: ModelPackage = {
  title: "Mistral (7b)",
  description:
    "A 7b parameter base model created by Mistral AI, very competent for code generation and other tasks",
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
  providerOptions: ["ollama", "lmstudio", "together", "llamacpp", "replicate"],
};

const mistralTiny: ModelPackage = {
  title: "Mistral Tiny (7b)",
  description: "An 7b parameter model created by Mistral AI",
  params: {
    title: "Mistral",
    model: "mistral-tiny",
    contextLength: 4096,
  },
  icon: "mistral.png",
  providerOptions: [
    "ollama",
    "lmstudio",
    "together",
    "llamacpp",
    "replicate",
    "mistral",
  ],
};
const mistralSmall: ModelPackage = {
  title: "Mixtral (8x7b)",
  description:
    "An 8x7b parameter Mixture of Experts model created by Mistral AI (a.k.a Mistral Small)",
  params: {
    title: "Mixtral",
    model: "mistral-small",
    contextLength: 4096,
  },
  icon: "mistral.png",
  providerOptions: [
    "ollama",
    "lmstudio",
    "together",
    "llamacpp",
    "replicate",
    "mistral",
  ],
};
const mistralMedium: ModelPackage = {
  title: "Mistral Medium",
  description: "A highly capable model created by Mistral AI",
  params: {
    title: "Mistral Medium",
    model: "mistral-medium",
    contextLength: 4096,
  },
  icon: "mistral.png",
  providerOptions: [
    "ollama",
    "lmstudio",
    "together",
    "llamacpp",
    "replicate",
    "mistral",
  ],
};

const geminiPro: ModelPackage = {
  title: "Gemini Pro",
  description: "A highly capable model created by Google DeepMind",
  params: {
    title: "Gemini Pro",
    model: "gemini-pro",
    contextLength: 32_000,
    apiKey: "<API_KEY>",
  },
  icon: "gemini.png",
  providerOptions: ["palm", "freetrial"],
};

const zephyr: ModelPackage = {
  title: "Zephyr-Beta (7b)",
  description:
    "A fine-tune of Mistral, trained on publicly available and synthetic datasets.",
  params: {
    title: "Zephyr",
    model: "zephyr-7b",
    contextLength: 4096,
  },
  icon: "mistral.png",
  providerOptions: ["ollama", "lmstudio", "llamacpp", "replicate"],
};

const deepseek: ModelPackage = {
  title: "DeepSeek-Coder",
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
  providerOptions: ["ollama", "lmstudio", "llamacpp"],
};

const codeup: ModelPackage = {
  title: "CodeUp (13b)",
  description: "An open-source coding model based on Llama2",
  params: {
    title: "CodeUp",
    model: "codeup-13b",
    contextLength: 4096,
  },
  providerOptions: ["ollama", "lmstudio", "llamacpp", "replicate"],
};

const neuralChat: ModelPackage = {
  title: "Neural-Chat-v3-3 (7b)",
  description:
    "A fine-tuned 7B parameter LLM on the Intel Gaudi 2 processor from the Intel/neural-chat-7b-v3-1 on the meta-math/MetaMathQA dataset.",
  params: {
    title: "NeuralChat",
    model: "neural-chat-7b",
    contextLength: 4096,
  },
  providerOptions: ["ollama", "lmstudio", "llamacpp", "replicate"],
};

const osModels = [
  deepseek,
  wizardCoder,
  codeLlamaInstruct,
  mistral,
  phindCodeLlama,
  llama2Chat,
  zephyr,
  neuralChat,
];

const gpt4turbo: ModelPackage = {
  title: "GPT-4 Turbo",
  description:
    "A faster, cheaper version of GPT-4 with a longer context length",
  params: {
    model: "gpt-4-turbo-preview",
    contextLength: 128_000,
    title: "gpt-4-turbo-preview",
  },
  providerOptions: ["openai", "freetrial"],
  icon: "openai.png",
};

const gpt4: ModelPackage = {
  title: "GPT-4",
  description: "The most powerful model from OpenAI",
  params: {
    model: "gpt-4",
    contextLength: 8096,
    title: "GPT-4",
  },
  providerOptions: ["openai", "freetrial"],
  icon: "openai.png",
};

const gpt4vision: ModelPackage = {
  title: "GPT-4 Vision",
  description:
    "A faster version of GPT-4 with longer context length and image support",
  params: {
    model: "gpt-4-vision-preview",
    contextLength: 128_000,
    title: "GPT-4 Vision",
  },
  providerOptions: ["openai", "freetrial"],
  icon: "openai.png",
};

const gpt35turbo: ModelPackage = {
  title: "GPT-3.5-Turbo",
  description:
    "A faster, cheaper OpenAI model with slightly lower capabilities",
  params: {
    model: "gpt-3.5-turbo",
    contextLength: 8096,
    title: "GPT-3.5-Turbo",
  },
  providerOptions: ["openai", "freetrial"],
  icon: "openai.png",
};

const claude2: ModelPackage = {
  title: "Claude 2",
  description: "A highly capable model with a 100k context length",
  params: {
    model: "claude-2.1",
    contextLength: 100_000,
    title: "Claude 2",
    apiKey: "",
  },
  providerOptions: ["anthropic"],
  icon: "anthropic.png",
};

const claude3Opus: ModelPackage = {
  title: "Claude 3 Opus",
  description:
    "Anthropic's most capable model, beating GPT-4 on many benchmarks",
  params: {
    model: "claude-3-opus-20240229",
    contextLength: 200_000,
    title: "Claude 3 Opus",
    apiKey: "",
  },
  providerOptions: ["anthropic", "freetrial"],
  icon: "anthropic.png",
};

const claude3Sonnet: ModelPackage = {
  title: "Claude 3 Sonnet",
  description:
    "The second most capable model in the Claude 3 series: ideal balance of intelligence and speed",
  params: {
    model: "claude-3-sonnet-20240229",
    contextLength: 200_000,
    title: "Claude 3 Sonnet",
    apiKey: "",
  },
  providerOptions: ["anthropic", "freetrial"],
  icon: "anthropic.png",
};

const claude3Haiku: ModelPackage = {
  title: "Claude 3 Haiku",
  description:
    "The third most capable model in the Claude 3 series: fastest and most compact model for near-instant responsiveness",
  params: {
    model: "claude-3-haiku-20240307",
    contextLength: 200_000,
    title: "Claude 3 Haiku",
    apiKey: "",
  },
  providerOptions: ["anthropic", "freetrial"],
  icon: "anthropic.png",
};

const chatBison: ModelPackage = {
  title: "chat-bison-001",
  description:
    "Google PaLM's chat-bison-001 model, fine-tuned for chatting about code",
  params: {
    model: "chat-bison-001",
    contextLength: 8000,
    apiKey: "",
    title: "Chat Bison",
  },
  providerOptions: ["palm"],
  icon: "google-palm.png",
};

const AUTODETECT: ModelPackage = {
  title: "Autodetect",
  description:
    "Automatically populate the model list by calling the /models endpoint of the server",
  params: {
    model: "AUTODETECT",
  } as any,
  providerOptions: [],
};

export const MODEL_INFO: ModelPackage[] = [
  gpt4turbo,
  gpt4,
  gpt35turbo,
  geminiPro,
  claude3Opus,
  claude3Sonnet,
  claude3Haiku,
  claude2,
  deepseek,
  mistral,
  codellama70bTrial,
  wizardCoder,
  codeLlamaInstruct,
  phindCodeLlama,
  llama2Chat,
  zephyr,
];

export const PROVIDER_INFO: { [key: string]: ModelInfo } = {
  openai: {
    title: "OpenAI",
    provider: "openai",
    description: "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model",
    longDescription:
      "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model. See [here](https://openai.com/product#made-for-developers) to obtain an API key.",
    icon: "openai.png",
    tags: [ModelProviderTag["Requires API Key"]],
    packages: [
      gpt4,
      gpt35turbo,
      gpt4turbo,
      gpt4vision,
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "OpenAI",
        },
      },
    ],
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your OpenAI API key",
        required: true,
      },
      ...completionParamsInputs,
    ],
  },
  anthropic: {
    title: "Anthropic",
    provider: "anthropic",
    refPage: "anthropicllm",
    description:
      "Anthropic builds state-of-the-art models with large context length and high recall",
    icon: "anthropic.png",
    tags: [ModelProviderTag["Requires API Key"]],
    longDescription:
      "To get started with Anthropic models, you first need to sign up for the open beta [here](https://claude.ai/login) to obtain an API key.",
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Anthropic API key",
        required: true,
      },
      ...completionParamsInputs,
      {
        ...contextLengthInput,
        defaultValue: 100_000,
      },
    ],
    packages: [claude3Opus, claude3Sonnet, claude3Haiku, claude2],
  },
  ollama: {
    title: "Ollama",
    provider: "ollama",
    description:
      "One of the fastest ways to get started with local models on Mac, Linux, or Windows",
    longDescription:
      'To get started with Ollama, follow these steps:\n1. Download from [ollama.ai](https://ollama.ai/) and open the application\n2. Open a terminal and run `ollama run <MODEL_NAME>`. Example model names are `codellama:7b-instruct` or `llama2:7b-text`. You can find the full list [here](https://ollama.ai/library).\n3. Make sure that the model name used in step 2 is the same as the one in config.py (e.g. `model="codellama:7b-instruct"`)\n4. Once the model has finished downloading, you can start asking questions through Continue.',
    icon: "ollama.png",
    tags: [ModelProviderTag["Local"], ModelProviderTag["Open-Source"]],
    packages: [
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "Ollama",
        },
      },
      ...osModels,
    ],
    collectInputFor: [
      ...completionParamsInputs,
      { ...apiBaseInput, defaultValue: "http://localhost:11434" },
    ],
  },
  together: {
    title: "TogetherAI",
    provider: "together",
    refPage: "togetherllm",
    description:
      "Use the TogetherAI API for extremely fast streaming of open-source models",
    icon: "together.png",
    longDescription: `Together is a hosted service that provides extremely fast streaming of open-source language models. To get started with Together:\n1. Obtain an API key from [here](https://together.ai)\n2. Paste below\n3. Select a model preset`,
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your TogetherAI API key",
        required: true,
      },
      ...completionParamsInputs,
    ],
    packages: [llama2Chat, codeLlamaInstruct, mistral].map((p) => {
      p.params.contextLength = 4096;
      return p;
    }),
  },
  groq: {
    title: "Groq",
    provider: "groq",
    icon: "groq.png",
    description:
      "Groq is the fastest LLM provider by a wide margin, using 'LPUs' to serve open-source models at blazing speed.",
    longDescription:
      "To get started with Groq, obtain an API key from their website [here](https://wow.groq.com/).",
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Groq API key",
        required: true,
      },
    ],
    packages: [
      { ...mixtralTrial, title: "Mixtral" },
      llama270bChat,
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "Groq",
        },
      },
      ,
    ],
  },
  palm: {
    title: "Google Gemini API",
    provider: "google-palm",
    refPage: "googlepalmapi",
    description:
      "Try out Google's state-of-the-art Gemini model from their API.",
    longDescription: `To get started with Google Gemini API, obtain your API key from [here](https://ai.google.dev/tutorials/workspace_auth_quickstart) and paste it below.`,
    icon: "gemini.png",
    tags: [ModelProviderTag["Requires API Key"]],
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Gemini API key",
        required: true,
      },
    ],
    packages: [geminiPro],
  },
  mistral: {
    title: "Mistral API",
    provider: "mistral",
    description:
      "The Mistral API provides hosted access to their models, including Mistral-7b, Mixtral, and the very capable mistral-medium",
    icon: "mistral.png",
    longDescription: `To get access to the Mistral API, obtain your API key from the [Mistral platform](https://docs.mistral.ai/)`,
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Mistral API key",
        required: true,
      },
      ...completionParamsInputs,
    ],
    packages: [mistralTiny, mistralSmall, mistralMedium].map((p) => {
      p.params.contextLength = 4096;
      return p;
    }),
  },
  lmstudio: {
    title: "LM Studio",
    provider: "lmstudio",
    description:
      "One of the fastest ways to get started with local models on Mac or Windows",
    longDescription:
      "LMStudio provides a professional and well-designed GUI for exploring, configuring, and serving LLMs. It is available on both Mac and Windows. To get started:\n1. Download from [lmstudio.ai](https://lmstudio.ai/) and open the application\n2. Search for and download the desired model from the home screen of LMStudio.\n3. In the left-bar, click the '<->' icon to open the Local Inference Server and press 'Start Server'.\n4. Once your model is loaded and the server has started, you can begin using Continue.",
    icon: "lmstudio.png",
    tags: [ModelProviderTag["Local"], ModelProviderTag["Open-Source"]],
    params: {
      apiBase: "http://localhost:1234/v1/",
    },
    packages: [
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "LM Studio",
        },
      },
      ...osModels,
    ],
    collectInputFor: [...completionParamsInputs],
  },
  llamafile: {
    title: "llamafile",
    provider: "llamafile",
    icon: "llamafile.png",
    description:
      "llamafiles are a self-contained binary to run an open-source LLM",
    longDescription: `To get started with llamafiles, find and download a binary on their [GitHub repo](https://github.com/Mozilla-Ocho/llamafile#binary-instructions). Then run it with the following command:\n\n\`\`\`shell\nchmod +x ./llamafile\n./llamafile\n\`\`\``,
    tags: [ModelProviderTag["Local"], ModelProviderTag["Open-Source"]],
    packages: osModels,
    collectInputFor: [...completionParamsInputs],
  },
  replicate: {
    title: "Replicate",
    provider: "replicate",
    refPage: "replicatellm",
    description: "Use the Replicate API to run open-source models",
    longDescription: `Replicate is a hosted service that makes it easy to run ML models. To get started with Replicate:\n1. Obtain an API key from [here](https://replicate.com)\n2. Paste below\n3. Select a model preset`,
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Replicate API key",
        required: true,
      },
      ...completionParamsInputs,
    ],
    icon: "replicate.png",
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    packages: [codeLlamaInstruct, llama2Chat, wizardCoder, mistral, zephyr],
  },
  llamacpp: {
    title: "llama.cpp",
    provider: "llama.cpp",
    refPage: "llamacpp",
    description: "If you are running the llama.cpp server from source",
    longDescription: `llama.cpp comes with a [built-in server](https://github.com/ggerganov/llama.cpp/tree/master/examples/server#llamacppexampleserver) that can be run from source. To do this:
    
1. Clone the repository with \`git clone https://github.com/ggerganov/llama.cpp\`.
2. \`cd llama.cpp\`
3. Run \`make\` to build the server.
4. Download the model you'd like to use and place it in the \`llama.cpp/models\` directory (the best place to find models is [The Bloke on HuggingFace](https://huggingface.co/TheBloke))
5. Run the llama.cpp server with the command below (replacing with the model you downloaded):

\`\`\`shell
.\\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models/codellama-7b-instruct.Q8_0.gguf
\`\`\`

After it's up and running, you can start using Continue.`,
    icon: "llamacpp.png",
    tags: [ModelProviderTag.Local, ModelProviderTag["Open-Source"]],
    packages: osModels,
    collectInputFor: [...completionParamsInputs],
  },
  // bedrock: {
  //   title: "Bedrock",
  //   provider: "bedrock",
  //   refPage: "amazon.com",
  //   description:
  //     "Bedrock is Amazon's provider of multiple diverse language models.",
  //   tags: [ModelProviderTag["Requires API Key"]],
  //   packages: [claude3Sonnet, claude3Haiku],
  // },
  "openai-aiohttp": {
    title: "Other OpenAI-compatible API",
    provider: "openai",
    description:
      "If you are using any other OpenAI-compatible API, for example text-gen-webui, FastChat, LocalAI, or llama-cpp-python, you can simply enter your server URL",
    longDescription: `If you are using any other OpenAI-compatible API, you can simply enter your server URL. If you still need to set up your model server, you can follow a guide below:

- [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
- [LocalAI](https://localai.io/basics/getting_started/)
- [llama-cpp-python](https://github.com/continuedev/ggml-server-example)
- [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)`,
    params: {
      apiBase: "",
    },
    collectInputFor: [
      {
        ...apiBaseInput,
        defaultValue: "http://localhost:8000/v1/",
      },
      ...completionParamsInputs,
    ],
    icon: "openai.png",
    tags: [ModelProviderTag.Local, ModelProviderTag["Open-Source"]],
    packages: [
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "OpenAI",
        },
      },
      ...osModels,
    ],
  },
  freetrial: {
    title: "Continue limited free trial",
    provider: "free-trial",
    refPage: "freetrial",
    description:
      "New users can try out Continue for free using a proxy server that securely makes calls to OpenAI, Google, or Together using our API key",
    longDescription:
      'New users can try out Continue for free using a proxy server that securely makes calls to OpenAI, Google, or Together using our API key. If you are ready to use your own API key or have used all 250 free uses, you can enter your API key in config.py where it says `apiKey=""` or select another model provider.',
    icon: "openai.png",
    tags: [ModelProviderTag.Free],
    packages: [
      codellama70bTrial,
      mixtralTrial,
      { ...claude3Opus, title: "Claude 3 Opus (trial)" },
      { ...claude3Sonnet, title: "Claude 3 Sonnet (trial)" },
      { ...claude3Haiku, title: "Claude 3 Haiku (trial)" },
      { ...geminiPro, title: "Gemini Pro (trial)" },
      { ...gpt4vision, title: "GPT-4 Vision (trial)" },
      { ...gpt35turbo, title: "GPT-3.5-Turbo (trial)" },
      {
        ...AUTODETECT,
        params: {
          ...AUTODETECT.params,
          title: "Free Trial",
        },
      },
    ],
    collectInputFor: [...completionParamsInputs],
  },
};
