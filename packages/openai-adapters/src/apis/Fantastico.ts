import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Model,
} from "openai/resources/index";

import { OpenAIConfig } from "../types.js";
import { customFetch } from "../util.js";
import { OpenAIApi } from "./OpenAI.js";

const DEFAULT_CONTROL_PLANE = "https://fantastico.cc/api";
// Mint a fresh key this long before the current one expires
const EXPIRY_SKEW_MS = 60_000;

interface RuntimeKey {
  key: string;
  baseUrl: string;
  chatDefaults: Record<string, unknown>;
  expiresAt: number;
}

interface MintResponse {
  runtimeKey: string;
  expiresAt: string;
  baseUrl: string;
  chatDefaults?: Record<string, unknown> | null;
}

/**
 * Fantastico does not proxy inference. The user's Fantastico key is exchanged
 * for a short-lived, spend-capped runtime key, which is then used directly
 * against the OpenAI-compatible endpoint returned by the mint.
 *
 * The key prefix picks the route: project keys (`sk-fant-`) mint on
 * `/runtime/key`, account keys (`ck-fant-`) on `/edge/key`.
 */
export class FantasticoApi extends OpenAIApi {
  private controlPlane: string;
  private fetchFn: ReturnType<typeof customFetch>;
  private runtimeKeyPromise: Promise<RuntimeKey> | null = null;
  private chatDefaults: Record<string, unknown> = {};

  constructor(config: OpenAIConfig) {
    const controlPlane = (config.apiBase ?? DEFAULT_CONTROL_PLANE).replace(
      /\/+$/,
      "",
    );
    super({ ...config, apiBase: `${controlPlane}/` });
    this.controlPlane = controlPlane;
    this.fetchFn = customFetch(config.requestOptions);
  }

  private mintUrl(): string {
    const apiKey = this.config.apiKey ?? "";
    if (apiKey.startsWith("ck-fant-")) {
      return `${this.controlPlane}/edge/key`;
    }
    if (apiKey.startsWith("sk-fant-")) {
      return `${this.controlPlane}/runtime/key`;
    }
    throw new Error(
      "Fantastico adapter: apiKey must be an account key (ck-fant-…) or a project key (sk-fant-…).",
    );
  }

  private async mint(): Promise<RuntimeKey> {
    const res = await this.fetchFn(this.mintUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        type?: string;
        message?: string;
      };
      // e.g. ALLOWANCE_EXHAUSTED: the account is out of credit and must be topped up
      throw new Error(
        `Fantastico: could not obtain a runtime key (${res.status}${
          body.type ? ` ${body.type}` : ""
        })${body.message ? `: ${body.message}` : ""}`,
      );
    }
    const data = (await res.json()) as MintResponse;
    if (!data.runtimeKey || !data.baseUrl) {
      throw new Error(
        "Fantastico: mint response is missing runtimeKey or baseUrl",
      );
    }
    return {
      key: data.runtimeKey,
      baseUrl: data.baseUrl.replace(/\/+$/, ""),
      chatDefaults:
        data.chatDefaults && typeof data.chatDefaults === "object"
          ? data.chatDefaults
          : {},
      expiresAt: new Date(data.expiresAt).getTime(),
    };
  }

  /**
   * Returns a valid runtime key, minting one if there is none or it is about
   * to expire, and points the OpenAI client at the endpoint it belongs to.
   */
  private async ensureRuntimeKey(): Promise<RuntimeKey> {
    if (this.runtimeKeyPromise) {
      const current = await this.runtimeKeyPromise.catch(() => null);
      if (current && current.expiresAt - Date.now() > EXPIRY_SKEW_MS) {
        return current;
      }
    }
    const promise = this.mint().then((runtimeKey) => {
      this.apiBase = `${runtimeKey.baseUrl}/`;
      this.chatDefaults = runtimeKey.chatDefaults;
      this.openai = new OpenAI({
        apiKey: runtimeKey.key,
        baseURL: this.apiBase,
        fetch: this.fetchFn,
        timeout: this.config.requestOptions?.timeout || undefined,
      });
      return runtimeKey;
    });
    this.runtimeKeyPromise = promise;
    // Clear cache on failure so transient errors don't prevent retries
    promise.catch(() => {
      if (this.runtimeKeyPromise === promise) {
        this.runtimeKeyPromise = null;
      }
    });
    return promise;
  }

  /**
   * 401: the key expired or was revoked. 402: it reached its spending cap.
   * Either way a freshly minted key may succeed, so it is worth one retry.
   */
  private isRemintable(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    return status === 401 || status === 402;
  }

  private async withRemint<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureRuntimeKey();
    try {
      return await fn();
    } catch (error) {
      if (!this.isRemintable(error)) {
        throw error;
      }
      this.runtimeKeyPromise = null;
      await this.ensureRuntimeKey();
      return fn();
    }
  }

  private async *withRemintStream<T>(
    fn: () => AsyncGenerator<T, any, unknown>,
  ): AsyncGenerator<T, any, unknown> {
    await this.ensureRuntimeKey();
    let yielded = false;
    try {
      for await (const chunk of fn()) {
        yielded = true;
        yield chunk;
      }
    } catch (error) {
      // Retrying after partial output would duplicate it
      if (yielded || !this.isRemintable(error)) {
        throw error;
      }
      this.runtimeKeyPromise = null;
      await this.ensureRuntimeKey();
      yield* fn();
    }
  }

  override modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    // Whatever the caller sets wins over the mint's defaults
    return { ...this.chatDefaults, ...super.modifyChatBody(body) };
  }

  protected override getHeaders(): Record<string, string> {
    return {
      ...super.getHeaders(),
      "x-api-key": this.openai.apiKey,
      Authorization: `Bearer ${this.openai.apiKey}`,
    };
  }

  override chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    return this.withRemint(() => super.chatCompletionNonStream(body, signal));
  }

  override chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    return this.withRemintStream(() =>
      super.chatCompletionStream(body, signal),
    );
  }

  override completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    return this.withRemint(() => super.completionNonStream(body, signal));
  }

  override completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion, any, unknown> {
    return this.withRemintStream(() => super.completionStream(body, signal));
  }

  override embed(
    body: OpenAI.Embeddings.EmbeddingCreateParams,
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    return this.withRemint(() => super.embed(body));
  }

  override list(): Promise<Model[]> {
    return this.withRemint(() => super.list());
  }
}

export default FantasticoApi;
