import Handlebars from "handlebars";
import { BaseLLM } from "..";
import {
  BaseCompletionOptions,
  ILLM,
  LLMOptions,
  ModelDescription,
} from "../..";
import { DEFAULT_MAX_TOKENS } from "../constants";
import Anthropic from "./Anthropic";
import Bedrock from "./Bedrock";
import Cohere from "./Cohere";
import DeepInfra from "./DeepInfra";
import Flowise from "./Flowise";
import FreeTrial from "./FreeTrial";
import Gemini from "./Gemini";
import Groq from "./Groq";
import HuggingFaceInferenceAPI from "./HuggingFaceInferenceAPI";
import HuggingFaceTGI from "./HuggingFaceTGI";
import LMStudio from "./LMStudio";
import LlamaCpp from "./LlamaCpp";
import Llamafile from "./Llamafile";
import Mistral from "./Mistral";
import Ollama from "./Ollama";
import OpenAI from "./OpenAI";
import OpenAIFreeTrial from "./OpenAIFreeTrial";
import Replicate from "./Replicate";
import TextGenWebUI from "./TextGenWebUI";
import Together from "./Together";

function convertToLetter(num: number): string {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

const getHandlebarsVars = (
  value: string,
): [string, { [key: string]: string }] => {
  const ast = Handlebars.parse(value);

  let keysToFilepath: { [key: string]: string } = {};
  let keyIndex = 1;
  for (let i in ast.body) {
    if (ast.body[i].type === "MustacheStatement") {
      const letter = convertToLetter(keyIndex);
      keysToFilepath[letter] = (ast.body[i] as any).path.original;
      value = value.replace(
        new RegExp("{{\\s*" + (ast.body[i] as any).path.original + "\\s*}}"),
        `{{${letter}}}`,
      );
      keyIndex++;
    }
  }
  return [value, keysToFilepath];
};

export async function renderTemplatedString(
  template: string,
  readFile: (filepath: string) => Promise<string>,
  inputData: any,
): Promise<string> {
  const [newTemplate, vars] = getHandlebarsVars(template);
  const data: any = { ...inputData };
  for (const key in vars) {
    const fileContents = await readFile(vars[key]);
    data[key] = fileContents || (inputData[vars[key]] ?? vars[key]);
  }
  const templateFn = Handlebars.compile(newTemplate);
  const final = templateFn(data);
  return final;
}

const LLMs = [
  Anthropic,
  Cohere,
  FreeTrial,
  Gemini,
  Llamafile,
  Ollama,
  Replicate,
  TextGenWebUI,
  Together,
  HuggingFaceTGI,
  HuggingFaceInferenceAPI,
  LlamaCpp,
  OpenAI,
  LMStudio,
  Mistral,
  Bedrock,
  DeepInfra,
  OpenAIFreeTrial,
  Flowise,
  Groq,
];

export async function llmFromDescription(
  desc: ModelDescription,
  readFile: (filepath: string) => Promise<string>,
  writeLog: (log: string) => Promise<void>,
  completionOptions?: BaseCompletionOptions,
  systemMessage?: string,
): Promise<BaseLLM | undefined> {
  const cls = LLMs.find((llm) => llm.providerName === desc.provider);

  if (!cls) {
    return undefined;
  }

  const finalCompletionOptions = {
    ...completionOptions,
    ...desc.completionOptions,
  };

  systemMessage = desc.systemMessage ?? systemMessage;
  if (systemMessage !== undefined) {
    systemMessage = await renderTemplatedString(systemMessage, readFile, {});
  }

  const options: LLMOptions = {
    ...desc,
    completionOptions: {
      ...finalCompletionOptions,
      model: (desc.model || cls.defaultOptions?.model) ?? "codellama-7b",
      maxTokens:
        finalCompletionOptions.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens ??
        DEFAULT_MAX_TOKENS,
    },
    systemMessage,
    writeLog,
  };

  return new cls(options);
}

export function llmFromProviderAndOptions(
  providerName: string,
  llmOptions: LLMOptions,
): ILLM {
  const cls = LLMs.find((llm) => llm.providerName === providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}
