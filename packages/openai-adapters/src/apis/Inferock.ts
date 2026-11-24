import { ChatCompletionCreateParams } from "openai/resources/index";
import { InferockConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";

const DANE_UNSUPPORTED_FIELDS = [
  "temperature",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "stop",
  "response_format",
  "parallel_tool_calls",
  "prediction",
  "store",
  "user",
] as const;

export function normalizeInferockApiBase(apiBase: string | undefined): string {
  const raw = apiBase?.trim();
  if (!raw) {
    throw new Error(
      "Inferock requires apiBase set to your Gateway base URL (from Settings -> Inferock keys).",
    );
  }
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? `${stripped}/` : `${stripped}/v1/`;
}

export function sanitizeDaneRequestBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  for (const field of DANE_UNSUPPORTED_FIELDS) {
    delete body[field];
  }
  if (Array.isArray(body.tools)) {
    body.tools = body.tools.map((tool: any) => {
      if (tool?.function && "strict" in tool.function) {
        const { strict: _strict, ...fn } = tool.function;
        return { ...tool, function: fn };
      }
      return tool;
    });
  }
  return body;
}

export class InferockApi extends OpenAIApi {
  private readonly extraBodyProperties?: Record<string, unknown>;

  constructor(config: InferockConfig) {
    const existingHeaders = config.requestOptions?.headers ?? {};
    const hasGovHeader = Object.keys(existingHeaders).some(
      (k) => k.toLowerCase() === "x-governance-provider",
    );
    const { extraBodyProperties, ...restRequestOptions } =
      config.requestOptions ?? {};
    super({
      ...config,
      provider: "openai",
      apiBase: normalizeInferockApiBase(config.apiBase),
      requestOptions: {
        ...restRequestOptions,
        headers: {
          ...(hasGovHeader ? {} : { "x-governance-provider": "inferock-serve" }),
          ...existingHeaders,
        },
      },
    });
    if (
      typeof config.requestOptions?.timeout === "number" &&
      config.requestOptions.timeout > 0
    ) {
      // Continue configures requestOptions.timeout in seconds; OpenAI SDK expects milliseconds.
      this.openai.timeout = config.requestOptions.timeout * 1000;
    }
    this.extraBodyProperties = extraBodyProperties;
  }

  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    body = super.modifyChatBody(body);

    const merged = this.extraBodyProperties
      ? ({ ...body, ...this.extraBodyProperties } as Record<string, unknown>)
      : (body as unknown as Record<string, unknown>);

    if (merged.model === "dane") {
      sanitizeDaneRequestBody(merged);
    }

    return merged as unknown as T;
  }
}
