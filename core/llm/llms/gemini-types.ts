import { JSONSchema7Object } from "json-schema";
import { Tool } from "../..";

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

export type GeminiObjectSchemaType =
  | "TYPE_UNSPECIFIED"
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

export interface GeminiObjectSchema {
  type: GeminiObjectSchemaType;
  format?: string;
  title?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  maxItems?: string;
  minItems?: string;
  properties?: Record<string, GeminiObjectSchema>;
  required?: string[];
  anyOf?: GeminiObjectSchema[];
  propertyOrdering?: string[];
  items?: GeminiObjectSchema;
  minimum?: number;
  maximum?: number;
}

const jsonSchemaTypeToGeminiType = (
  jsonSchemaType: string,
): GeminiObjectSchemaType => {
  switch (jsonSchemaType.toLowerCase()) {
    case "string":
      return "STRING";
    case "object":
      return "OBJECT";
    case "number":
      return "NUMBER";
    case "integer":
      return "INTEGER";
    case "array":
      return "ARRAY";
    case "boolean":
      return "BOOLEAN";
    default:
      return "TYPE_UNSPECIFIED";
  }
};

function convertJsonSchemaToGeminiSchema(jsonSchema: any): GeminiObjectSchema {
  if (!jsonSchema || typeof jsonSchema !== "object" || Array.isArray(jsonSchema)) {
    return { type: "TYPE_UNSPECIFIED" };
  }

  const jsonSchemaType =
    typeof jsonSchema.type === "string"
      ? jsonSchema.type
      : Array.isArray(jsonSchema.type)
        ? jsonSchema.type.find((t: unknown) => typeof t === "string" && t !== "null") ??
          jsonSchema.type.find((t: unknown) => typeof t === "string")
        : jsonSchema.properties &&
            typeof jsonSchema.properties === "object" &&
            !Array.isArray(jsonSchema.properties)
          ? "object"
          : jsonSchema.items
            ? "array"
            : undefined;

  if (!jsonSchemaType) {
    return { type: "TYPE_UNSPECIFIED" };
  }
  const geminiSchema: GeminiObjectSchema = {
    type: jsonSchemaTypeToGeminiType(jsonSchemaType),
  };

  // if (jsonSchema.format) geminiSchema.format = jsonSchema.format;
  if (jsonSchema.description) geminiSchema.description = jsonSchema.description;

  // Handle nullable
  if (
    jsonSchemaType === "null" ||
    jsonSchema.nullable ||
    (Array.isArray(jsonSchema.type) && jsonSchema.type.includes("null"))
  ) {
    geminiSchema.nullable = true;
  }

  // Handle enum values
  if (Array.isArray(jsonSchema.enum)) {
    geminiSchema.enum = jsonSchema.enum.map(String);
  }

  // Handle array constraints
  if (jsonSchemaType === "array") {
    if (typeof jsonSchema.maxItems !== "undefined") {
      geminiSchema.maxItems = String(jsonSchema.maxItems);
    }
    if (typeof jsonSchema.minItems !== "undefined") {
      geminiSchema.minItems = String(jsonSchema.minItems);
    }
    // Handle array items
    if (jsonSchema.items && typeof jsonSchema.items === "object") {
      geminiSchema.items = convertJsonSchemaToGeminiSchema(jsonSchema.items);
    }
  }

  // Handle numeric constraints
  if (typeof jsonSchema.minimum !== "undefined") {
    geminiSchema.minimum = Number(jsonSchema.minimum);
  }
  if (typeof jsonSchema.maximum !== "undefined") {
    geminiSchema.maximum = Number(jsonSchema.maximum);
  }

  // Handle properties for objects
  if (jsonSchema.properties) {
    if (typeof jsonSchema.properties === "object" && !Array.isArray(jsonSchema.properties)) {
      geminiSchema.properties = {};
      for (const [key, value] of Object.entries(jsonSchema.properties)) {
        if (value && typeof value === "object") {
          geminiSchema.properties[key] = convertJsonSchemaToGeminiSchema(value);
        }
      }
    }
  }

  // Handle required properties
  if (Array.isArray(jsonSchema.required)) {
    geminiSchema.required = jsonSchema.required;
  }

  // Handle anyOf
  if (Array.isArray(jsonSchema.anyOf)) {
    const anyOf = jsonSchema.anyOf
      .filter((s: unknown) => s && typeof s === "object" && !Array.isArray(s))
      .map(convertJsonSchemaToGeminiSchema);
    if (anyOf.length) {
      geminiSchema.anyOf = anyOf;
    }
  }

  // TODO/UNSUPPORTED:
  // format
  // property ordering:
  // if (Array.isArray(jsonSchema.propertyOrdering)) {
  //   geminiSchema.propertyOrdering = jsonSchema.propertyOrdering;
  // }

  return geminiSchema;
}

// https://ai.google.dev/api/caching#FunctionDeclaration
// Note "reponse" field (schema showing function output structure) is not supported at the moment
export function convertContinueToolToGeminiFunction(
  tool: Tool,
): GeminiToolFunctionDeclaration {
  if (!tool.function.name) {
    throw new Error("Function name required");
  }
  const description = tool.function.description ?? "";
  const name = tool.function.name;

  const fn: GeminiToolFunctionDeclaration = {
    description,
    name,
  };

  const params = tool.function.parameters;
  if (
    params &&
    typeof params === "object" &&
    !Array.isArray(params) &&
    "type" in params &&
    typeof (params as any).type === "string"
  ) {
    // Gemini can't take an empty object
    // So if empty object param is present just don't add parameters
    if ((params as any).type === "object") {
      const props = (params as any).properties;
      const isEmptyProps =
        !props ||
        (typeof props === "object" && !Array.isArray(props) && Object.keys(props).length === 0);
      if (isEmptyProps) {
        return fn;
      }
    }

    fn.parameters = convertJsonSchemaToGeminiSchema(params);
  }

  return fn;
}

export type GeminiTextContentPart = {
  text: string;
};

export type GeminiInlineDataContentPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

export type GeminiFunctionCallContentPart = {
  functionCall: {
    id?: string;
    name: string;
    args: JSONSchema7Object;
  };
  thoughtSignature?: string;
};

export type GeminiFunctionResponseContentPart = {
  functionResponse: {
    id?: string;
    name: string;
    response: JSONSchema7Object;
  };
};

export type GeminiFileDataContentPart = {
  fileData: {
    fileUri: string;
    mimeType: string; // See possible values here: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#filedata
  };
};

export type GeminiExecutableCodeContentPart = {
  executableCode: {
    language: "PYTHON" | "LANGUAGE_UNSPECIFIED";
    code: string;
  };
};

export type GeminiCodeExecutionResultContentPart = {
  codeExecutionResult: {
    outcome:
      | "OUTCOME_UNSPECIFIED"
      | "OUTCOME_OK"
      | "OUTCOME_FAILED"
      | "OUTCOME_DEADLINE_EXCEEDED";
    output: string;
  };
};

export type GeminiChatContentPart =
  | GeminiTextContentPart
  | GeminiInlineDataContentPart
  | GeminiFunctionCallContentPart
  | GeminiFunctionResponseContentPart
  | GeminiFileDataContentPart
  | GeminiExecutableCodeContentPart
  | GeminiCodeExecutionResultContentPart;

export interface GeminiChatContent {
  role?: "user" | "model";
  parts: GeminiChatContentPart[];
}

export interface GeminiToolFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiObjectSchema;
  response?: GeminiObjectSchema;
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
