export interface LlmInfo {
  model: string;
  displayName?: string;
  description?: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  regex?: RegExp;

  /** If not set, assumes "text" only */
  mediaTypes?: MediaType[];
}

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
