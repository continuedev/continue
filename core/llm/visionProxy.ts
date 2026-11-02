/**
 * Vision Proxy — Route image messages through a Vision Language Model (VLM)
 * before sending to the main LLM.
 *
 * Flow:
 *   1. Scan messages for image content parts
 *   2. Send images to VLM (e.g., Qwen2.5-VL-32B) for text description
 *   3. Replace image parts with [Image Description: ...] text
 *   4. Return text-only messages for the main LLM (e.g., DeepSeek V4 Flash)
 *
 * This enables text-only LLMs to "understand" images via a multi-model pipeline,
 * maximizing context length (524K) while retaining visual understanding capability.
 */

import { ChatMessage, ImageMessagePart, MessagePart } from "..";
import { fetchwithRequestOptions } from "@continuedev/fetch";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VisionProxyOptions {
  /** VLM endpoint (OpenAI-compatible), e.g. http://171.232.252.166:7002/v1 */
  endpoint: string;

  /** VLM model name, e.g. Qwen/Qwen2.5-VL-32B-Instruct */
  model: string;

  /** API key for VLM endpoint */
  apiKey?: string;

  /** Max tokens for VLM description response (default: 2048) */
  maxTokens?: number;

  /**
   * Prompt template for image description.
   * - "code": OCR-focused — extracts ONLY code from editor area, ignores UI
   * - "config": OCR-focused — extracts ONLY config content (YAML/JSON/TOML)
   * - "error": OCR-focused — extracts ONLY error messages and stack traces
   * - "ui": Describes UI/UX screenshots, web pages
   * - "diagram": Describes architecture diagrams, flowcharts
   * - "auto": General-purpose — prioritizes code, ignores UI chrome
   * - string: Custom prompt template
   */
  promptTemplate?: "code" | "config" | "error" | "ui" | "diagram" | "auto" | string;

  /** Temperature for VLM (default: 0.2 for deterministic descriptions) */
  temperature?: number;

  /** Request timeout in ms (default: 30000) */
  timeout?: number;

  /** Enable/disable vision proxy (default: true when configured) */
  enabled?: boolean;
}

// ─── Prompt Templates ────────────────────────────────────────────────────────

const PROMPT_TEMPLATES: Record<string, string> = {
  code: `You are an OCR tool for code screenshots. Your ONLY task is to extract and transcribe code from the editor area of this image.

RULES:
- Output ONLY the code content, nothing else
- Do NOT describe the image, UI, layout, or design
- Do NOT add explanations, markdown formatting, or code fences
- Preserve exact indentation and line breaks
- If there are multiple visible code blocks, transcribe each one separated by a blank line
- Ignore ALL UI elements: sidebars, status bars, buttons, file trees, git graphs, task lists, terminal output
- If the image contains a diff view, transcribe the changed lines with their +/- markers
- If no code content is visible, say exactly: "[No code content visible in this image]"`,

  config: `You are an OCR tool for configuration files. Extract ONLY the configuration content from this image.

RULES:
- Output ONLY the config content (YAML, JSON, TOML, etc.)
- Ignore ALL UI elements, file trees, terminal output, and non-config content
- Preserve exact indentation
- Do not wrap in markdown code blocks
- Include commented lines if visible
- If no config content is visible, say exactly: "[No configuration content visible in this image]"`,

  error: `You are an OCR tool for error messages. Extract ONLY the error content from this image.

RULES:
- Focus on error text, stack traces, error codes, and warning messages
- Ignore surrounding UI elements
- Output the error message exactly as shown
- Preserve all formatting of the error (line breaks, indentation)
- If no error content is visible, say exactly: "[No error content visible in this image]"`,

  ui: `Describe this UI screenshot:
1. What application or webpage is shown?
2. Describe the layout (header, sidebar, content, footer)
3. List all visible text, buttons, and form elements
4. Note any error states, loading indicators, or unusual elements
Be concise and structured.`,

  diagram: `Describe this technical diagram:
1. What type of diagram is it? (flowchart, architecture, sequence, ER, etc.)
2. List all components/nodes and their labels
3. Describe the connections/relationships between components
4. Note any annotations, colors, or groupings
Be precise about the relationships and data flow.`,

  auto: `You are analyzing a screenshot of a code editor (VS Code or similar).

TASK: Extract ALL code/content from the editor area ONLY.

RULES:
1. FIRST PRIORITY: Transcribe any visible code or configuration exactly
2. If a filename is visible (from tab, breadcrumb, or title bar), note it as: [File: filename.ext]
3. Note any error messages, warnings, or terminal output if present
4. IGNORE completely: UI elements, sidebars, status bars, buttons, file trees, git graphs, task lists
5. IGNORE completely: Descriptions of the layout, colors, or visual design
6. If the image is mostly UI with little code, say "[No significant code content]"

Output format:
[File: filename.ext if visible]
<transcribed code/content>`,
};

// ─── Description Cache ───────────────────────────────────────────────────────

interface CacheEntry {
  description: string;
  timestamp: number;
}

const descriptionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a cache key for an image URL (strip any query params that change per-request)
 */
function getCacheKey(imageUrl: string): string {
  // Use the base64 data or URL without random query params
  return imageUrl.split("?")[0];
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Check if a message contains image content parts
 */
function hasImageContent(content: string | MessagePart[]): boolean {
  if (typeof content === "string") return false;
  return content.some((part) => part.type === "imageUrl");
}

/**
 * Extract image parts from message content
 */
function extractImageParts(content: MessagePart[]): ImageMessagePart[] {
  return content.filter(
    (part) => part.type === "imageUrl",
  ) as ImageMessagePart[];
}

/**
 * Get the prompt template string based on option
 */
function getPromptTemplate(template?: string): string {
  if (!template) return PROMPT_TEMPLATES.auto;
  if (template in PROMPT_TEMPLATES) return PROMPT_TEMPLATES[template];
  // Custom template string
  return template;
}

/**
 * Call VLM to describe a single image
 */
async function describeImage(
  imageUrl: string,
  options: VisionProxyOptions,
  signal?: AbortSignal,
): Promise<string> {
  // Check cache first
  const cacheKey = getCacheKey(imageUrl);
  const cached = descriptionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("[VisionProxy] Cache hit — reusing previous description");
    return cached.description;
  }

  const endpoint = options.endpoint.replace(/\/$/, "");
  const url = `${endpoint}/chat/completions`;
  const promptText = getPromptTemplate(options.promptTemplate);

  const templateName = options.promptTemplate || "auto";
  console.log(
    `[VisionProxy] Describing image with template "${templateName}"...`,
  );

  const requestBody = {
    model: options.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: promptText,
          },
        ],
      },
    ],
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.2,
    stream: false,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = options.timeout ?? 30000;

  // Combine external signal with timeout
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    // Use fetchwithRequestOptions to respect TLS settings (verifySsl: false)
    // This ensures self-signed certs for on-prem/internal VLM endpoints are accepted
    const response = await fetchwithRequestOptions(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
      { verifySsl: false },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.warn(
        `[VisionProxy] VLM request failed (${response.status}): ${errorText}`,
      );
      return `[Image: VLM description failed — ${response.status}]`;
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.warn("[VisionProxy] VLM returned empty content");
      return "[Image: VLM returned empty description]";
    }

    const trimmed = content.trim();
    console.log(
      `[VisionProxy] VLM returned ${trimmed.length} chars (template: "${templateName}")`,
    );

    // Save to cache
    descriptionCache.set(cacheKey, {
      description: trimmed,
      timestamp: Date.now(),
    });

    return trimmed;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn("[VisionProxy] VLM request timed out or was aborted");
      return "[Image: VLM request timed out]";
    }
    console.warn(`[VisionProxy] VLM request error: ${error.message}`);
    return `[Image: VLM error — ${error.message}]`;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Process messages through vision proxy.
 * Images are sent to VLM for description, then replaced with text.
 * Messages without images pass through unchanged.
 *
 * @param messages - Chat messages (internal Continue format)
 * @param options - Vision proxy configuration
 * @param signal - Optional abort signal
 * @returns Processed messages with images replaced by text descriptions
 */
export async function processMessagesWithVisionProxy(
  messages: ChatMessage[],
  options: VisionProxyOptions,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  if (!options.enabled && options.enabled !== undefined) {
    return messages;
  }

  const result: ChatMessage[] = [];

  for (const message of messages) {
    // Only process user messages that have array content with images
    if (
      message.role === "user" &&
      Array.isArray(message.content) &&
      hasImageContent(message.content)
    ) {
      const processedParts: MessagePart[] = [];
      const imageParts = extractImageParts(message.content);

      // Process each part
      for (const part of message.content) {
        if (part.type === "imageUrl") {
          // Send image to VLM for description
          const description = await describeImage(
            (part as ImageMessagePart).imageUrl.url,
            options,
            signal,
          );
          processedParts.push({
            type: "text",
            text: `\n[Image Description]\n${description}\n[/Image Description]\n`,
          });
        } else {
          // Keep text parts as-is
          processedParts.push(part);
        }
      }

      result.push({ ...message, content: processedParts });
    } else {
      // Non-image messages pass through unchanged
      result.push(message);
    }
  }

  const imageCount = messages.filter(
    (m) => m.role === "user" && Array.isArray(m.content) && hasImageContent(m.content),
  ).length;
  if (imageCount > 0) {
    console.log(
      `[VisionProxy] Processed ${imageCount} image message(s) through VLM`,
    );
  }

  return result;
}
