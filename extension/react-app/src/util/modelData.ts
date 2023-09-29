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
  key: "context_length",
  label: "Context Length",
  defaultValue: 2048,
  required: false,
};

export interface ModelInfo {
  title: string;
  class: string;
  description: string;
  longDescription?: string;
  icon?: string;
  tags?: ModelProviderTag[];
  packages: ModelPackage[];
  params?: any;
  collectInputFor?: InputDescriptor[];
}

export interface ModelPackage {
  collectInputFor?: InputDescriptor[];
  description: string;
  title: string;
  refUrl?: string;
  tags?: ModelProviderTag[];
  icon?: string;
  params: {
    model: string;
    template_messages?: string;
    context_length: number;
    stop_tokens?: string[];
    prompt_templates?: any;
    replace?: [string, string][];
    [key: string]: any;
  };
}

const codeLlama7bInstruct: ModelPackage = {
  title: "CodeLlama-7b-Instruct",
  description: "A 7b parameter model tuned for code generation",
  refUrl: "",
  params: {
    title: "CodeLlama-7b-Instruct",
    model: "codellama:7b-instruct",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};
const codeLlama13bInstruct: ModelPackage = {
  title: "CodeLlama-13b-Instruct",
  description: "A 13b parameter model tuned for code generation",
  refUrl: "",
  params: {
    title: "CodeLlama13b-Instruct",
    model: "codellama13b-instruct",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};
const codeLlama34bInstruct: ModelPackage = {
  title: "CodeLlama-34b-Instruct",
  description: "A 34b parameter model tuned for code generation",
  refUrl: "",
  params: {
    title: "CodeLlama-34b-Instruct",
    model: "codellama:34b-instruct",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};

const llama2Chat7b: ModelPackage = {
  title: "Llama2-7b-Chat",
  description: "A 7b parameter model fine-tuned for chat",
  refUrl: "",
  params: {
    title: "Llama2-7b-Chat",
    model: "llama2:7b-chat",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};
const llama2Chat13b: ModelPackage = {
  title: "Llama2-13b-Chat",
  description: "A 13b parameter model fine-tuned for chat",
  refUrl: "",
  params: {
    title: "Llama2-13b-Chat",
    model: "llama2:13b-chat",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};
const llama2Chat34b: ModelPackage = {
  title: "Llama2-34b-Chat",
  description: "A 34b parameter model fine-tuned for chat",
  refUrl: "",
  params: {
    title: "Llama2-34b-Chat",
    model: "llama2:34b-chat",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};

const codeLlamaPackages = [
  codeLlama7bInstruct,
  codeLlama13bInstruct,
  codeLlama34bInstruct,
];

const llama2Packages = [llama2Chat7b, llama2Chat13b, llama2Chat34b];
const llama2FamilyPackage = {
  title: "Llama2 or CodeLlama",
  description: "Any model using the Llama2 or CodeLlama chat template",
  params: {
    model: "llama2",
    context_length: 2048,
    template_messages: "llama2_template_messages",
  },
  icon: "meta.svg",
};

const gpt4: ModelPackage = {
  title: "GPT-4",
  description: "The latest model from OpenAI",
  params: {
    model: "gpt-4",
    context_length: 8096,
    api_key: "",
    title: "GPT-4",
  },
};

const gpt35turbo: ModelPackage = {
  title: "GPT-3.5-Turbo",
  description:
    "A faster, cheaper OpenAI model with slightly lower capabilities",
  params: {
    model: "gpt-3.5-turbo",
    context_length: 8096,
    title: "GPT-3.5-Turbo",
    api_key: "",
  },
};

export const MODEL_INFO: { [key: string]: ModelInfo } = {
  openai: {
    title: "OpenAI",
    class: "OpenAI",
    description: "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model",
    icon: "openai.svg",
    tags: [ModelProviderTag["Requires API Key"]],
    packages: [gpt4, gpt35turbo],
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "api_key",
        label: "API Key",
        placeholder: "Enter your OpenAI API key",
        required: true,
      },
    ],
  },
  anthropic: {
    title: "Anthropic",
    class: "AnthropicLLM",
    description:
      "Claude-2 is a highly capable model with a 100k context length",
    icon: "anthropic.png",
    tags: [ModelProviderTag["Requires API Key"]],
    longDescription:
      "To get started with Anthropic models, you first need to sign up for the open beta [here](https://claude.ai/login) to obtain an API key.",
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "api_key",
        label: "API Key",
        placeholder: "Enter your Anthropic API key",
        required: true,
      },
    ],
    packages: [
      {
        title: "Claude-2",
        description: "A highly capable model with a 100k context length",
        params: {
          model: "claude-2",
          context_length: 100000,
          title: "Claude-2",
        },
      },
    ],
  },
  ollama: {
    title: "Ollama",
    class: "Ollama",
    description:
      "One of the fastest ways to get started with local models on Mac or Linux",
    icon: "ollama.png",
    tags: [ModelProviderTag["Local"], ModelProviderTag["Open-Source"]],
    packages: [
      ...codeLlamaPackages.map((p) => ({
        ...p,
        refUrl: "https://ollama.ai/library/codellama",
      })),
      ...llama2Packages.map((p) => ({
        ...p,
        refUrl: "https://ollama.ai/library/llama2",
      })),
    ],
    collectInputFor: [contextLengthInput],
  },
  together: {
    title: "TogetherAI",
    class: "TogetherLLM",
    description:
      "Use the TogetherAI API for extremely fast streaming of open-source models",
    icon: "together.png",
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    params: {
      api_key: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "api_key",
        label: "API Key",
        placeholder: "Enter your TogetherAI API key",
        required: true,
      },
    ],
    packages: [
      ...codeLlamaPackages.map((p) => {
        return {
          ...p,
          params: {
            ...p.params,
            model:
              "togethercomputer/" +
              p.params.model.replace("llama2", "llama-2").replace(":", "-"),
          },
        };
      }),
      ...llama2Packages.map((p) => {
        return {
          ...p,
          params: {
            ...p.params,
            model:
              "togethercomputer/" +
              p.params.model
                .replace("codellama", "CodeLlama")
                .replace(":", "-")
                .replace("instruct", "Instruct"),
          },
        };
      }),
    ].map((p) => {
      p.params.context_length = 4096;
      return p;
    }),
  },
  lmstudio: {
    title: "LM Studio",
    class: "GGML",
    description:
      "One of the fastest ways to get started with local models on Mac or Windows",
    icon: "lmstudio.png",
    tags: [ModelProviderTag["Local"], ModelProviderTag["Open-Source"]],
    params: {
      server_url: "http://localhost:1234",
    },
    packages: [llama2FamilyPackage],
    collectInputFor: [contextLengthInput],
  },
  replicate: {
    title: "Replicate",
    class: "ReplicateLLM",
    description: "Use the Replicate API to run open-source models",
    params: {
      api_key: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "api_key",
        label: "API Key",
        placeholder: "Enter your Replicate API key",
        required: true,
      },
    ],
    icon: "replicate.png",
    tags: [
      ModelProviderTag["Requires API Key"],
      ModelProviderTag["Open-Source"],
    ],
    packages: [...codeLlamaPackages, ...llama2Packages].map((p) => {
      return {
        ...p,
        params: {
          ...p.params,
          model:
            "meta/" +
            p.params.model.replace(":", "-").replace("llama2", "llama-2"),
        },
      };
    }),
  },
  llamacpp: {
    title: "llama.cpp",
    class: "LlamaCpp",
    description: "If you are running the llama.cpp server from source",
    icon: "llamacpp.png",
    tags: [ModelProviderTag.Local, ModelProviderTag["Open-Source"]],
    packages: [llama2FamilyPackage],
    collectInputFor: [contextLengthInput],
  },
  hftgi: {
    title: "HuggingFace TGI",
    class: "HuggingFaceTGI",
    description:
      "HuggingFace Text Generation Inference is an advanced, highly performant option for serving open-source models to multiple people",
    icon: "hf.png",
    tags: [ModelProviderTag.Local, ModelProviderTag["Open-Source"]],
    packages: [llama2FamilyPackage],
    collectInputFor: [contextLengthInput],
  },
  ggml: {
    title: "Other OpenAI-compatible API",
    class: "GGML",
    description:
      "If you are using any other OpenAI-compatible API, for example text-gen-webui, FastChat, LocalAI, or llama-cpp-python, you can simply enter your server URL",
    params: {
      server_url: "",
    },
    collectInputFor: [
      {
        inputType: CollectInputType.text,
        key: "server_url",
        label: "Server URL",
        placeholder: "e.g. http://localhost:8080",
        required: false,
      },
      contextLengthInput,
    ],
    icon: "openai.svg",
    tags: [ModelProviderTag.Local, ModelProviderTag["Open-Source"]],
    packages: [llama2FamilyPackage],
  },
  freetrial: {
    title: "GPT-4 limited free trial",
    class: "OpenAIFreeTrial",
    description:
      "New users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key",
    icon: "openai.svg",
    tags: [ModelProviderTag.Free],
    packages: [gpt4, gpt35turbo],
  },
};
