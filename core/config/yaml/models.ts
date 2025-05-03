import { ModelConfig } from "@continuedev/config-yaml";

import {
  ContinueConfig,
  IDE,
  IdeSettings,
  ILLMLogger,
  LLMOptions,
  ModelCapability
} from "../..";
import { BaseLLM } from "../../llm";
import { LLMClasses } from "../../llm/llms";

// 拡張されたCompletionOptions型（思考機能対応）
interface ThinkingConfig {
  type: string;
  budget_tokens: number;
}

// モデル設定で使う拡張CompletionOptions型
interface EnhancedCompletionOptions {
  contextLength?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stop?: string[];
  n?: number;
  
  // 追加のオプション
  thinking?: ThinkingConfig;
  stepByStepThinking?: boolean;
  timeout?: number;
  stream?: boolean;
}

// ModelConfig型を拡張して拡張したCompletionOptionsを使用するように
interface EnhancedModelConfig extends Omit<ModelConfig, 'defaultCompletionOptions'> {
  defaultCompletionOptions?: EnhancedCompletionOptions;
}

const AUTODETECT = "AUTODETECT";

function getModelClass(
  model: ModelConfig,
): (typeof LLMClasses)[number] | undefined {
  return LLMClasses.find((llm) => llm.providerName === model.provider);
}

/**
 * 安全なアシスタント設定パース関数（改良版） - デフォルト値対応
 * @param yaml YAMLデータ
 * @returns パースされたアシスタント、または失敗時にはデフォルト値
 */
export function parseAssistant(yaml: any): any {
  // null/undefined の場合はデフォルト値を提供
  if (!yaml) {
    console.warn('Invalid assistant config, using default settings');
    return {
      name: 'Default Assistant',
      provider: 'databricks',
      model: 'claude-3-7-sonnet',
      capabilities: ['tool_use', 'image_input'],
      defaultCompletionOptions: {
        thinking: { type: 'enabled', budget_tokens: 16000 },
        stepByStepThinking: true,
        stream: true,
        maxTokens: 100000,
        timeout: 600000 // 10分
      }
    };
  }
  
  // 既存値の検証と設定
  if (!yaml.provider) {
    console.warn('Assistant config missing provider, using default');
    yaml.provider = 'databricks';
  }
  
  if (!yaml.model) {
    console.warn('Assistant config missing model, using default');
    yaml.model = 'claude-3-7-sonnet';
  }
  
  // 必須フィールドの存在確認
  if (!yaml.defaultCompletionOptions) {
    yaml.defaultCompletionOptions = {};
  }
  
  // 思考機能のデフォルト設定
  if (!yaml.defaultCompletionOptions.thinking) {
    yaml.defaultCompletionOptions.thinking = {
      type: 'enabled',
      budget_tokens: 16000
    };
  } else if (typeof yaml.defaultCompletionOptions.thinking === 'object') {
    // 部分的な設定の場合は不足部分を補完
    const thinking = yaml.defaultCompletionOptions.thinking;
    if (!thinking.type) thinking.type = 'enabled';
    if (!thinking.budget_tokens) thinking.budget_tokens = 16000;
  } else {
    // オブジェクトでない場合は完全に置き換え
    yaml.defaultCompletionOptions.thinking = {
      type: 'enabled',
      budget_tokens: 16000
    };
  }
  
  // ステップバイステップ思考のデフォルト値
  if (yaml.defaultCompletionOptions.stepByStepThinking === undefined) {
    yaml.defaultCompletionOptions.stepByStepThinking = true;
  }
  
  // ストリーミング設定のデフォルト値
  if (yaml.defaultCompletionOptions.stream === undefined) {
    yaml.defaultCompletionOptions.stream = true;
  }
  
  // トークン数上限のデフォルト値
  if (yaml.defaultCompletionOptions.maxTokens === undefined) {
    yaml.defaultCompletionOptions.maxTokens = 100000;
  }
  
  // タイムアウト設定のデフォルト値
  if (yaml.defaultCompletionOptions.timeout === undefined) {
    yaml.defaultCompletionOptions.timeout = 600000; // 10分
  }
  
  // ケイパビリティの修正
  if (!yaml.capabilities) {
    yaml.capabilities = ['tool_use', 'image_input'];
  } else if (!Array.isArray(yaml.capabilities)) {
    // オブジェクト形式の場合は配列に変換
    const capabilities = [];
    if (yaml.capabilities.toolUse || yaml.capabilities.tools) capabilities.push('tool_use');
    if (yaml.capabilities.imageInput || yaml.capabilities.image) capabilities.push('image_input');
    yaml.capabilities = capabilities;
  }
  
  return yaml;
}

/**
 * モデル設定からLLMインスタンスを作成する強化版関数
 */
async function modelConfigToBaseLLM({
  model,
  uniqueId,
  ideSettings,
  llmLogger,
  config,
}: {
  model: ModelConfig;
  uniqueId: string;
  ideSettings: IdeSettings;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
}): Promise<BaseLLM | undefined> {
  // モデルクラスの検証
  const cls = getModelClass(model);
  if (!cls) {
    console.warn(`Unknown model provider: ${model.provider}`);
    return undefined;
  }

  const { capabilities, ...rest } = model;

  // モデル設定を拡張型として扱う
  const enhancedModel = model as EnhancedModelConfig;

  // Databricksモデルの場合の特別な処理
  const isDatabricksProvider = model.provider === 'databricks';
  const isClaudeModel = isDatabricksProvider && 
                        (model.model || '').toLowerCase().includes('claude');
  const isClaudeSonnet37 = isClaudeModel &&
                          ((model.model || '').toLowerCase().includes('claude-3-7') ||
                           (model.model || '').toLowerCase().includes('claude-3.7'));

  // モデル設定のデフォルト値設定
  if (isDatabricksProvider && !enhancedModel.defaultCompletionOptions) {
    enhancedModel.defaultCompletionOptions = {};
  }

  // Claude 3.7専用設定
  if (isClaudeSonnet37) {
    if (!enhancedModel.defaultCompletionOptions!.thinking) {
      enhancedModel.defaultCompletionOptions!.thinking = { type: "enabled", budget_tokens: 16000 };
    }
    if (enhancedModel.defaultCompletionOptions!.stepByStepThinking === undefined) {
      enhancedModel.defaultCompletionOptions!.stepByStepThinking = true;
    }
    if (enhancedModel.defaultCompletionOptions!.maxTokens === undefined) {
      enhancedModel.defaultCompletionOptions!.maxTokens = 100000;
    }
    if (enhancedModel.defaultCompletionOptions!.timeout === undefined) {
      enhancedModel.defaultCompletionOptions!.timeout = 600000; // 10分
    }
  }

  // LLMオプションの構築
  let options: LLMOptions = {
    ...rest,
    contextLength: enhancedModel.defaultCompletionOptions?.contextLength,
    completionOptions: {
      ...(enhancedModel.defaultCompletionOptions ?? {}),
      model: model.model,
      maxTokens:
        enhancedModel.defaultCompletionOptions?.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    logger: llmLogger,
    uniqueId,
    title: model.name,
    promptTemplates: model.promptTemplates,
    baseChatSystemMessage: model.chatOptions?.baseSystemMessage,
    capabilities: {
      tools: model.capabilities?.includes("tool_use"),
      uploadImage: model.capabilities?.includes("image_input"),
    },
  };

  // モデルのケイパビリティ設定
  if (capabilities?.find((c) => c === "tool_use")) {
    options.capabilities = {
      ...options.capabilities,
      tools: true,
    };
  }

  if (capabilities?.find((c) => c === "image_input")) {
    options.capabilities = {
      ...options.capabilities,
      uploadImage: true,
    };
  }

  // 埋め込み設定
  if (model.embedOptions?.maxBatchSize) {
    options.maxEmbeddingBatchSize = model.embedOptions.maxBatchSize;
  }
  if (model.embedOptions?.maxChunkSize) {
    options.maxEmbeddingChunkSize = model.embedOptions.maxChunkSize;
  }

  // 環境設定の処理
  const env = model.env ?? {};
  if (
    "useLegacyCompletionsEndpoint" in env &&
    typeof env.useLegacyCompletionsEndpoint === "boolean"
  ) {
    options.useLegacyCompletionsEndpoint = env.useLegacyCompletionsEndpoint;
  }
  if ("apiType" in env && typeof env.apiType === "string") {
    options.apiType = env.apiType;
  }
  if ("apiVersion" in env && typeof env.apiVersion === "string") {
    options.apiVersion = env.apiVersion;
  }
  if ("deployment" in env && typeof env.deployment === "string") {
    options.deployment = env.deployment;
  }
  if ("deploymentId" in env && typeof env.deploymentId === "string") {
    options.deploymentId = env.deploymentId;
  }
  if ("projectId" in env && typeof env.projectId === "string") {
    options.projectId = env.projectId;
  }
  if ("region" in env && typeof env.region === "string") {
    options.region = env.region;
  }
  if ("profile" in env && typeof env.profile === "string") {
    options.profile = env.profile;
  }
  if ("modelArn" in env && typeof env.modelArn === "string") {
    options.modelArn = env.modelArn;
  }
  if ("aiGatewaySlug" in env && typeof env.aiGatewaySlug === "string") {
    options.aiGatewaySlug = env.aiGatewaySlug;
  }
  if ("accountId" in env && typeof env.accountId === "string") {
    options.accountId = env.accountId;
  }

  try {
    const llm = new cls(options);
    return llm;
  } catch (error) {
    console.error(`Error creating LLM instance for ${model.provider}/${model.model}:`, error);
    return undefined;
  }
}

async function autodetectModels({
  llm,
  model,
  ide,
  uniqueId,
  ideSettings,
  llmLogger,
  config,
}: {
  llm: BaseLLM;
  model: ModelConfig;
  ide: IDE;
  uniqueId: string;
  ideSettings: IdeSettings;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
}): Promise<BaseLLM[]> {
  try {
    const modelNames = await llm.listModels();
    const detectedModels = await Promise.all(
      modelNames.map(async (modelName) => {
        // 無限ループ防止
        if (modelName === AUTODETECT) {
          return undefined;
        }

        return await modelConfigToBaseLLM({
          model: {
            ...model,
            model: modelName,
            name: modelName,
          },
          uniqueId,
          ideSettings,
          llmLogger,
          config,
        });
      }),
    );
    return detectedModels.filter((x) => typeof x !== "undefined") as BaseLLM[];
  } catch (e) {
    console.warn("Error listing models: ", e);
    return [];
  }
}

/**
 * モデル設定からLLMインスタンスのリストを作成する強化版関数
 */
export async function llmsFromModelConfig({
  model,
  ide,
  uniqueId,
  ideSettings,
  llmLogger,
  config,
}: {
  model: ModelConfig;
  ide: IDE;
  uniqueId: string;
  ideSettings: IdeSettings;
  llmLogger: ILLMLogger;
  config: ContinueConfig;
}): Promise<BaseLLM[]> {
  try {
    // nullチェックと安全な呼び出し
    if (!model) {
      console.warn("Model config is null or undefined, using default settings");
      // デフォルト設定を適用（Databricks Claude 3.7 Sonnet用）
      const defaultModel: EnhancedModelConfig = {
        name: "Claude 3.7 Sonnet (Databricks)",
        provider: "databricks",
        model: "databricks-claude-3-7-sonnet",
        capabilities: ["tool_use", "image_input"],
        defaultCompletionOptions: {
          thinking: { type: "enabled", budget_tokens: 16000 },
          stepByStepThinking: true,
          stream: true,
          maxTokens: 100000,
          timeout: 600000
        }
      };
      
      model = defaultModel as ModelConfig;
    }
    
    const baseLlm = await modelConfigToBaseLLM({
      model,
      uniqueId,
      ideSettings,
      llmLogger,
      config,
    });
    
    if (!baseLlm) {
      console.warn(`Failed to create LLM instance for ${model.provider}/${model.model}`);
      return [];
    }

    if (model.model === AUTODETECT) {
      const models = await autodetectModels({
        llm: baseLlm,
        model,
        ide,
        uniqueId,
        ideSettings,
        llmLogger,
        config,
      });
      return models;
    } else {
      return [baseLlm];
    }
  } catch (error) {
    console.error("Error creating LLM from model config:", error);
    return [];
  }
}