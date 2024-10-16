import { ModelProvider } from "core";
import { HTMLInputTypeAttribute } from "react";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../../util/freeTrial";
import { completionParamsInputs } from "./completionParamsInputs";
import type { ModelPackage } from "./models";
import { models } from "./models";
import { ModelProviderTags } from "../../../components/modelSelection/utils";

export interface InputDescriptor {
  inputType: HTMLInputTypeAttribute;
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

export interface ProviderInfo {
  title: string;
  icon?: string;
  provider: ModelProvider;
  description: string;
  longDescription?: string;
  tags?: ModelProviderTags[];
  packages: ModelPackage[];
  params?: any;
  collectInputFor?: InputDescriptor[];
  refPage?: string;
  apiKeyUrl?: string;
  downloadUrl?: string;
}

const completionParamsInputsConfigs = Object.values(completionParamsInputs);

const openSourceModels = Object.values(models).filter(
  ({ isOpenSource }) => isOpenSource,
);

export const apiBaseInput: InputDescriptor = {
  inputType: "text",
  key: "apiBase",
  label: "API Base",
  placeholder: "e.g. http://localhost:8080",
  required: false,
};

export const providers: Partial<Record<ModelProvider, ProviderInfo>> = {
  openai: {
    title: "OpenAI",
    provider: "openai",
    description: "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model",
    longDescription:
      "Use gpt-4, gpt-3.5-turbo, or any other OpenAI model. See [here](https://openai.com/product#made-for-developers) to obtain an API key.",
    icon: "openai.png",
    tags: [ModelProviderTags.RequiresApiKey],
    packages: [
      models.gpt4o,
      models.gpt4omini,
      models.gpt4turbo,
      models.gpt35turbo,
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "OpenAI",
        },
      },
    ],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your OpenAI API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    apiKeyUrl: "https://platform.openai.com/account/api-keys",
  },
  anthropic: {
    title: "Anthropic",
    provider: "anthropic",
    refPage: "anthropicllm",
    description:
      "Anthropic builds state-of-the-art models with large context length and high recall",
    icon: "anthropic.png",
    tags: [ModelProviderTags.RequiresApiKey],
    longDescription:
      "To get started with Anthropic models, you first need to sign up for the open beta [here](https://claude.ai/login) to obtain an API key.",
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Anthropic API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
      {
        ...completionParamsInputs.contextLength,
        defaultValue: 100000,
      },
    ],
    packages: [
      models.claude35Sonnet,
      models.claude3Opus,
      models.claude3Sonnet,
      models.claude3Haiku,
    ],
    apiKeyUrl: "https://console.anthropic.com/account/keys",
  },
  azure: {
    title: "Azure OpenAI",
    provider: "azure",
    description:
      "Azure OpenAI Service offers industry-leading coding and language AI models that you can fine-tune to your specific needs for a variety of use cases.",
    longDescription: `[Visit our documentation](https://docs.continue.dev/reference/Model%20Providers/azure) for information on obtaining an API key.

Select the \`GPT-4o\` model below to complete your provider configuration, but note that this will not affect the specific model you need to select when creating your Azure deployment.`,
    icon: "azure.png",
    tags: [ModelProviderTags.RequiresApiKey],
    refPage: "azure",
    apiKeyUrl:
      "https://azure.microsoft.com/en-us/products/ai-services/openai-service",
    packages: [models.gpt4o],
    params: {
      apiKey: "",
      engine: "",
      apiBase: "",
      apiVersion: "",
      apiType: "azure",
    },
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Azure OpenAI API key",
        required: true,
      },
      {
        inputType: "text",
        key: "engine",
        label: "Engine",
        placeholder: "Enter the engine name",
        required: true,
      },
      { ...apiBaseInput, required: true },
      {
        inputType: "text",
        key: "apiVersion",
        label: "API Version",
        placeholder: "Enter the API version",
        required: false,
        defaultValue: "2023-07-01-preview",
      },
      ...completionParamsInputsConfigs,
    ],
  },
  mistral: {
    title: "Mistral",
    provider: "mistral",
    description:
      "The Mistral API provides seamless access to their models, including Codestral, Mistral 8x22B, Mistral Large, and more.",
    icon: "mistral.png",
    longDescription: `To get access to the Mistral API, obtain your API key from [here](https://console.mistral.ai/codestral) for Codestral or the [Mistral platform](https://docs.mistral.ai/) for all other models.`,
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Mistral API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    packages: [
      models.codestral,
      models.codestralMamba,
      models.mistralLarge,
      models.mistralSmall,
      models.mistral8x22b,
      models.mistral8x7b,
      models.mistral7b,
    ],
    apiKeyUrl: "https://console.mistral.ai/codestral",
  },
  ollama: {
    title: "Ollama",
    provider: "ollama",
    description:
      "One of the fastest ways to get started with local models on Mac, Linux, or Windows",
    longDescription:
      'To get started with Ollama, follow these steps:\n1. Download from [ollama.ai](https://ollama.ai/download) and open the application\n2. Open a terminal and run `ollama run <MODEL_NAME>`. Example model names are `codellama:7b-instruct` or `llama2:7b-text`. You can find the full list [here](https://ollama.ai/library).\n3. Make sure that the model name used in step 2 is the same as the one in config.json (e.g. `model="codellama:7b-instruct"`)\n4. Once the model has finished downloading, you can start asking questions through Continue.',
    icon: "ollama.png",
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    packages: [
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "Ollama",
        },
      },
      ...openSourceModels,
    ],
    collectInputFor: [
      ...completionParamsInputsConfigs,
      { ...apiBaseInput, defaultValue: "http://localhost:11434" },
    ],
    downloadUrl: "https://ollama.ai/download",
  },
  cohere: {
    title: "Cohere",
    provider: "cohere",
    refPage: "cohere",
    description:
      "Optimized for enterprise generative AI, search and discovery, and advanced retrieval.",
    icon: "cohere.png",
    tags: [ModelProviderTags.RequiresApiKey],
    longDescription:
      "To use Cohere, visit the [Cohere dashboard](https://dashboard.cohere.com/api-keys) to create an API key.",
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Cohere API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    packages: [models.commandR, models.commandRPlus],
  },
  groq: {
    title: "Groq",
    provider: "groq",
    icon: "groq.png",
    description:
      "Groq is the fastest LLM provider by a wide margin, using 'LPUs' to serve open-source models at blazing speed.",
    longDescription:
      "To get started with Groq, obtain an API key from their website [here](https://wow.groq.com/).",
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Groq API key",
        required: true,
      },
    ],
    packages: [
      models.llama31405bChat,
      models.llama3170bChat,
      models.llama318bChat,
      { ...models.mixtralTrial, title: "Mixtral" },
      models.llama270bChat,
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "Groq",
        },
      },
    ],
    apiKeyUrl: "https://console.groq.com/keys",
  },
  deepseek: {
    title: "DeepSeek",
    provider: "deepseek",
    icon: "deepseek.png",
    description:
      "DeepSeek provides cheap inference of its DeepSeek Coder v2 and other impressive open-source models.",
    longDescription:
      "To get started with DeepSeek, obtain an API key from their website [here](https://platform.deepseek.com/api_keys).",
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your DeepSeek API key",
        required: true,
      },
    ],
    packages: [models.deepseekCoderApi, models.deepseekChatApi],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
  },
  together: {
    title: "TogetherAI",
    provider: "together",
    refPage: "together",
    description:
      "Use the TogetherAI API for extremely fast streaming of open-source models",
    icon: "together.png",
    longDescription: `Together is a hosted service that provides extremely fast streaming of open-source language models. To get started with Together:\n1. Obtain an API key from [here](https://together.ai)\n2. Paste below\n3. Select a model preset`,
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your TogetherAI API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    packages: [
      models.llama31Chat,
      models.codeLlamaInstruct,
      models.mistralOs,
    ].map((p) => {
      p.params.contextLength = 4096;
      return p;
    }),
  },
  gemini: {
    title: "Google Gemini API",
    provider: "gemini",
    refPage: "geminiapi",
    description:
      "Try out Google's state-of-the-art Gemini model from their API.",
    longDescription: `To get started with Google Gemini API, obtain your API key from [here](https://ai.google.dev/tutorials/workspace_auth_quickstart) and paste it below.`,
    icon: "gemini.png",
    tags: [ModelProviderTags.RequiresApiKey],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Gemini API key",
        required: true,
      },
    ],
    packages: [models.gemini15Pro, models.geminiPro, models.gemini15Flash],
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
  lmstudio: {
    title: "LM Studio",
    provider: "lmstudio",
    description:
      "One of the fastest ways to get started with local models on Mac or Windows",
    longDescription:
      "LMStudio provides a professional and well-designed GUI for exploring, configuring, and serving LLMs. It is available on both Mac and Windows. To get started:\n1. Download from [lmstudio.ai](https://lmstudio.ai/) and open the application\n2. Search for and download the desired model from the home screen of LMStudio.\n3. In the left-bar, click the '<->' icon to open the Local Inference Server and press 'Start Server'.\n4. Once your model is loaded and the server has started, you can begin using Continue.",
    icon: "lmstudio.png",
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    params: {
      apiBase: "http://localhost:1234/v1/",
    },
    packages: [
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "LM Studio",
        },
      },
      ...openSourceModels,
    ],
    collectInputFor: [...completionParamsInputsConfigs],
    downloadUrl: "https://lmstudio.ai/",
  },
  llamafile: {
    title: "llamafile",
    provider: "llamafile",
    icon: "llamafile.png",
    description:
      "llamafiles are a self-contained binary to run an open-source LLM",
    longDescription: `To get started with llamafiles, find and download a binary on their [GitHub repo](https://github.com/Mozilla-Ocho/llamafile?tab=readme-ov-file#quickstart). Then run it with the following command:\n\n\`\`\`shell\nchmod +x ./llamafile\n./llamafile\n\`\`\``,
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    packages: openSourceModels,
    collectInputFor: [...completionParamsInputsConfigs],
    downloadUrl:
      "https://github.com/Mozilla-Ocho/llamafile?tab=readme-ov-file#quickstart",
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
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Replicate API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    icon: "replicate.png",
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    packages: [
      models.llama3Chat,
      models.codeLlamaInstruct,
      models.wizardCoder,
      models.mistralOs,
    ],
    apiKeyUrl: "https://replicate.com/account/api-tokens",
  },
  "llama.cpp": {
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
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    packages: openSourceModels,
    collectInputFor: [...completionParamsInputsConfigs],
    downloadUrl: "https://github.com/ggerganov/llama.cpp",
  },
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
      ...completionParamsInputsConfigs,
    ],
    icon: "openai.png",
    tags: [ModelProviderTags.Local, ModelProviderTags.OpenSource],
    packages: [
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "OpenAI",
        },
      },
      ...openSourceModels,
    ],
  },
  watsonx: {
    title: "IBM watsonx",
    provider: "watsonx",
    refPage: "watsonX",
    description:
      "Explore foundation models from IBM and other third-parties depending on your use case.",
    longDescription: `**watsonx**, developed by IBM, offers a variety of pre-trained AI foundation models that can be used for natural language processing (NLP), computer vision, and speech recognition tasks.

To get started, [register](https://dataplatform.cloud.ibm.com/registration/stepone?context=wx) on watsonx SaaS, create your first project and setup an [API key](https://www.ibm.com/docs/en/mas-cd/continuous-delivery?topic=cli-creating-your-cloud-api-key).`,
    collectInputFor: [
      {
        inputType: "text",
        key: "watsonxUrl",
        label: "watsonx URL",
        placeholder: "e.g. http://us-south.dataplatform.cloud.ibm.com",
        required: true,
      },
      {
        inputType: "text",
        key: "watsonxProjectId",
        label: "watsonx Project ID",
        placeholder: "Enter your project ID",
        required: true,
      },
      {
        inputType: "text",
        key: "watsonxCreds",
        label: "watsonx API key",
        placeholder: "Enter your API key (SaaS) or ZenApiKey (Software)",
        required: true,
      },
      {
        inputType: "text",
        key: "watsonxApiVersion",
        label: "watsonx API version",
        placeholder: "Enter the API Version",
        defaultValue: "2023-05-29",
        required: true,
      },
      {
        inputType: "text",
        key: "watsonxFullUrl",
        label: "Full watsonx URL",
        placeholder:
          "http://us-south.dataplatform.cloud.ibm.com/m1/v1/text/generation_stream?version=2023-05-29",
        required: false,
      },
      {
        inputType: "text",
        key: "watsonxStopToken",
        label: "Stop Token",
        placeholder: "<|im_end|>",
      },

      ...completionParamsInputsConfigs,
    ],
    icon: "watsonx.png",
    tags: [ModelProviderTags.RequiresApiKey],
    packages: [
      models.graniteCode,
      models.graniteChat,
      models.MistralLarge,
      models.MetaLlama3,
    ],
  },
  "free-trial": {
    title: "Continue limited free trial",
    provider: "free-trial",
    refPage: "freetrial",
    description:
      "New users can try out Continue for free using a proxy server that securely makes calls to OpenAI, Anthropic, or Together using our API key",
    longDescription: `New users can try out Continue for free using a proxy server that securely makes calls to OpenAI, Anthropic, or Together using our API key. If you are ready to set up a model for long-term use or have used all ${FREE_TRIAL_LIMIT_REQUESTS} free uses, you can enter your API key or use a local model.`,
    icon: "openai.png",
    tags: [ModelProviderTags.Free],
    packages: [
      models.llama31405bTrial,
      models.llama3170bTrial,
      { ...models.claude35Sonnet, title: "Claude 3.5 Sonnet (trial)" },
      { ...models.gpt4o, title: "GPT-4o (trial)" },
      { ...models.gpt35turbo, title: "GPT-3.5-Turbo (trial)" },
      { ...models.claude3Haiku, title: "Claude 3 Haiku (trial)" },
      models.mixtralTrial,
      { ...models.gemini15Pro, title: "Gemini 1.5 Pro (trial)" },
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "Free Trial",
        },
      },
    ],
    collectInputFor: [...completionParamsInputsConfigs],
  },
  sambanova: {
    title: "SambaNova Cloud",
    provider: "sambanova",
    refPage: "sambanova",
    description: "Use SambaNova Cloud for Llama3.1 fast inference performance",
    icon: "sambanova.png",
    longDescription: `The SambaNova Cloud is a cloud platform for running large AI models with the world record Llama 3.1 70B/405B performance. You can sign up [here](https://cloud.sambanova.ai/)`,
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    params: {
      apiKey: "",
    },
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your SambaNova Cloud API key",
        required: true,
      },
      ...completionParamsInputsConfigs,
    ],
    packages: [models.llama31Chat].map((p) => {
      p.params.contextLength = 4096;
      return p;
    }),
    apiKeyUrl: "https://cloud.sambanova.ai/apis",
  },
  notdiamond: {
    title: "Not Diamond",
    provider: "notdiamond",
    description:
      "Not Diamond is an AI model router that determines which LLM is best-suited to respond.",
    longDescription: `Not Diamond is an AI model router that automatically determines which LLM is best-suited to respond to any query, improving LLM output quality by combining multiple LLMs into a meta-model that learns when to call each LLM.`,
    icon: "notdiamond.png",
    tags: [ModelProviderTags.RequiresApiKey],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your NotDiamond API key",
        required: true,
      },
    ],
    packages: [models.NotDiamond],
    apiKeyUrl: "https://app.notdiamond.ai/keys",
  },
  cerebras: {
    title: "Cerebras",
    provider: "cerebras",
    icon: "cerebras.png",
    description:
      "Cerebras Inference is a custom silicon for fast inference of LLM models.",
    longDescription: "Get your API key [here](https://cloud.cerebras.ai/).",
    tags: [ModelProviderTags.RequiresApiKey, ModelProviderTags.OpenSource],
    collectInputFor: [
      {
        inputType: "text",
        key: "apiKey",
        label: "API Key",
        placeholder: "Enter your Cerebras API key",
        required: true,
      },
    ],
    packages: [
      models.llama3170bChat,
      models.llama318bChat,
      {
        ...models.AUTODETECT,
        params: {
          ...models.AUTODETECT.params,
          title: "Cerebras",
        },
      },
    ],
    apiKeyUrl: "https://cloud.cerebras.ai/",
  },
};
