import { JSONSchema7Object } from "json-schema";

// https://ai.google.dev/api/generate-content
export interface GeminiGenerationConfig {
  stopSequences?: string[];
  responseMimeType?: string;
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseLogprobs?: boolean;
  logprobs?: number;
  // responseSchema?: object; // https://ai.google.dev/api/caching#Schema
}

export interface GeminiFunctionSchema {
  type:
    | "TYPE_UNSPECIFIED"
    | "STRING"
    | "NUMBER"
    | "INTEGER"
    | "BOOLEAN"
    | "ARRAY"
    | "OBJECT";
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  maxItems?: string;
  minItems?: string;
  properties?: Record<string, GeminiFunctionSchema>;
  required?: string[];
  items?: GeminiFunctionSchema;
}

export type GeminiChatContentPart =
  | {
      text: string;
    }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    }
  | {
      functionCall: {
        name: string;
        args: JSONSchema7Object;
      };
    }
  | {
      functionResponse: {
        name: string;
        response: JSONSchema7Object;
      };
    }
  | {
      fileData: {
        fileUri: string;
        mimeType: string; // See possible values here: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#filedata
      };
    }
  | {
      executableCode: {
        language: "PYTHON" | "LANGUAGE_UNSPECIFIED";
        code: string;
      };
    }
  | {
      codeExecutionResult: {
        outcome:
          | "OUTCOME_UNSPECIFIED"
          | "OUTCOME_OK"
          | "OUTCOME_FAILED"
          | "OUTCOME_DEADLINE_EXCEEDED";
        output: string;
      };
    };
export interface GeminiChatContent {
  role?: "user" | "model";
  parts: GeminiChatContentPart[];
}

export interface GeminiToolFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiFunctionSchema;
}
export interface GeminiTool {
  functionDeclarations?: GeminiToolFunctionDeclaration[];
  googleSearchRetrieval?: {
    dynamicRetrievalConfig: {
      mode?: "MODE_DYNAMIC" | "MODE_UNSPECIFIED";
      dynamicThreshold?: number;
    };
  };
  codeExecution?: {};
}

export interface GeminiToolConfig {
  functionCallingConfig?: {
    mode?: "NONE" | "ANY" | "AUTO";
    allowedFunctionNames?: string[];
  };
}

// https://ai.google.dev/api/generate-content#request-body
export interface GeminiChatRequestBody {
  contents: GeminiChatContent[];
  tools?: GeminiTool[];
  toolConfig?: GeminiToolConfig;
  systemInstruction?: GeminiChatContent;
  generationConfig?: GeminiGenerationConfig;
  // cachedContent?: string;
}

export interface GeminiChatResponseSuccess {
  candidates: Candidate[];
  promptFeedback: PromptFeedback;
  usageMetadata: UsageMetadata;
}

export interface GeminiChatResponseError {
  error: {
    message: string;
  };
}

export type GeminiChatResponse =
  | GeminiChatResponseError
  | GeminiChatResponseSuccess;

interface PromptFeedback {
  blockReason?: BlockReason;
  safetyRatings: SafetyRating[];
}

enum BlockReason {
  BLOCK_REASON_UNSPECIFIED = "BLOCK_REASON_UNSPECIFIED",
  SAFETY = "SAFETY",
  OTHER = "OTHER",
  BLOCKLIST = "BLOCKLIST",
  PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
}

interface SafetyRating {
  harmCategory: HarmCategory;
  harmProbability: HarmProbability;
  blocked: boolean;
}

enum HarmCategory {
  HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
  HARM_CATEGORY_DEROGATORY = "HARM_CATEGORY_DEROGATORY",
  HARM_CATEGORY_TOXICITY = "HARM_CATEGORY_TOXICITY",
  HARM_CATEGORY_VIOLENCE = "HARM_CATEGORY_VIOLENCE",
  HARM_CATEGORY_SEXUAL = "HARM_CATEGORY_SEXUAL",
  HARM_CATEGORY_MEDICAL = "HARM_CATEGORY_MEDICAL",
  HARM_CATEGORY_DANGEROUS = "HARM_CATEGORY_DANGEROUS",
  HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
  HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY",
}

enum HarmProbability {
  HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED",
  NEGLIGIBLE = "NEGLIGIBLE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

interface UsageMetadata {
  promptTokenCount: number;
  cachedContentTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface Candidate {
  content: GeminiChatContent;
  finishReason: FinishReason;
  safetyRatings: SafetyRating[];
  tokenCount: number;
  groundingAttribution?: GroundingAttribution;
  groundingMetadata?: GroundingMetadata;
  avgLogprobs?: number;
  logprobs?: LogprobsResult;
  index: number;
}

enum FinishReason {
  FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
  STOP = "STOP",
  MAX_TOKENS = "MAX_TOKENS",
  SAFETY = "SAFETY",
  RECITATION = "RECITATION",
  LANGUAGE = "LANGUAGE",
  OTHER = "OTHER",
  BLOCKLIST = "BLOCKLIST",
  PROHIBITED_CONTENT = "PROHIBITED_CONTENT",
  SPII = "SPII",
  MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL",
}

interface GroundingAttribution {
  attributionSourceId: AttributionSourceId;
  groundingSourceContent: string;
}

interface AttributionSourceId {
  groundingPassage?: GroundingPassageId;
  semanticRetrieverChunk?: SemanticRetrieverChunk;
}

interface GroundingPassageId {
  passageId: string;
  partIndex: number;
}

interface SemanticRetrieverChunk {
  source: string;
  chunk: string;
}

interface GroundingMetadata {
  groundingSupport?: GroundingSupport[];
  webSearchQueries?: string[];
  searchEntryPoint?: SearchEntryPoint;
  retrievalMetadata?: RetrievalMetadata;
}

interface SearchEntryPoint {
  renderedContent?: string;
  sdkBlob?: string;
}

interface RetrievalMetadata {
  googleSearchDynamicRetrievalScore?: number;
}

interface GroundingSupport {
  groundingChunkIndices: number[];
  confidenceScores: number[];
  segment: Segment;
}

interface Segment {
  partIndex: number;
  startIndex: number;
  endIndex: number;
  text: string;
}

interface LogprobsResult {
  topCandidates: TopCandidates[];
  chosenCandidates: Candidate[];
}

interface TopCandidates {
  candidates: Candidate[];
}
