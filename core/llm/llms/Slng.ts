/**
 * SLNG Provider for Continue.dev
 *
 * This provider enables access to 19 SLNG voice AI models (11 TTS + 8 STT)
 * across EU, AU, and Asia regions.
 *
 * Documentation: https://docs.slng.ai
 * Models: https://docs.slng.ai/models
 */

import { LLM } from "../../index.js";
import { CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";

class Slng implements LLM {
  static providerName: ModelProvider = "slng";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.slng.ai/v1",
  };

  private apiKey: string;
  private apiBase: string;

  constructor(options: LLMOptions) {
    this.apiKey = options.apiKey || "";
    this.apiBase = options.apiBase || "https://api.slng.ai/v1";

    if (!this.apiKey) {
      throw new Error(
        "SLNG API key is required. Set it in your Continue config or via SLNG_API_KEY environment variable."
      );
    }
  }

  async *streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const endpoint = this.getEndpoint(options.model);

    const response = await fetch(`${this.apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: prompt,
        model: options.model,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `SLNG API error: ${response.status} ${response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.text || parsed.delta?.text || "";
            if (text) yield text;
          } catch (e) {
            // Skip invalid JSON
            console.warn("Failed to parse SSE data:", data);
          }
        }
      }
    }
  }

  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const endpoint = this.getEndpoint(options.model);

    const response = await fetch(`${this.apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: prompt,
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `SLNG API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.text || data.transcript || "";
  }

  listModels(): string[] {
    return [
      // TTS Models (11)
      "deepgram-aura-2",
      "bulbul-v3",
      "cartesia-sonic-3",
      "cartesia-sonic-3-5",
      "fish-tts-s2-1-pro",
      "gradium-tts",
      "inworld-max-1-5",
      "kugel-2",
      "murf-falcon",
      "sarvam-saaras",
      "soniox-tts-rt-v1",
      // STT Models (8)
      "deepgram-nova-3",
      "deepgram-nova-3-medical",
      "deepgram-nova-3-multi",
      "fish-audio-asr",
      "gradium-stt",
      "reson8-stt-v1",
      "soniox-speech-ai-rt-v5",
      "speechmatics-realtime-v2",
    ];
  }

  private getEndpoint(model: string): string {
    // Determine if TTS or STT based on model name
    const sttKeywords = ["nova", "asr", "stt", "speechmatics", "soniox-speech"];
    const isSTT = sttKeywords.some((keyword) => model.includes(keyword));

    if (isSTT) {
      return `/stt/slng/${model}`;
    } else {
      return `/tts/slng/${model}`;
    }
  }

  supportsFim(): boolean {
    return false;
  }
}

export default Slng;
