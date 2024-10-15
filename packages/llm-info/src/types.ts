export type UseCase = "chat" | "autocomplete" | "rerank" | "embed";

export type ParameterType = "string" | "number" | "boolean";

export interface Parameter {
  key: string;
  required: boolean;
  valueType: ParameterType;
  displayName?: string;
  description?: string;
  defaultValue?: any;
}

export interface LlmInfo {
  model: string;
  provider: string;
  displayName?: string;
  description?: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  regex?: RegExp;

  /** If not set, assumes "text" only */
  mediaTypes?: MediaType[];
  recommendedFor?: UseCase[];

  /** Any additional parameters required to configure the model */
  extraParameters?: Parameter[];
}

export type LlmInfoWithProvider = LlmInfo & {
  provider: string;
};

export enum MediaType {
  Text = "text",
  Image = "image",
  Audio = "audio",
  Video = "video",
}

export const AllMediaTypes = [
  MediaType.Text,
  MediaType.Image,
  MediaType.Audio,
  MediaType.Video,
];

export interface ApiProviderInfo {
  displayName: string;
  supportsStreaming: boolean;
  handlesTemplating: boolean;
}

export type ModelProviderCapability = "stream" | "fim" | "image";

export interface ModelProvider {
  id: string;
  displayName: string;
  // capabilities: ModelProviderCapability[];
  models: Omit<LlmInfo, "provider">[];

  /** Any additional parameters required to configure the model
   *
   * (other than apiKey, apiBase, which are assumed always. And of course model and provider always required)
   */
  extraParameters?: Parameter[];
}
