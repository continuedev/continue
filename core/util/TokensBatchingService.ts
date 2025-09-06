import { Telemetry } from "./posthog.js";

interface TokenBatch {
  model: string;
  provider: string;
  count: number;
  totalPromptTokens: number;
  totalGeneratedTokens: number;
  lastEventTime: number;
}

export class TokensBatchingService {
  private static instance: TokensBatchingService;
  private batches = new Map<string, TokenBatch>();
  private flushTimer: NodeJS.Timeout | null = null;

  private readonly BATCH_SIZE_LIMIT = 25;
  private readonly FLUSH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  static getInstance(): TokensBatchingService {
    if (!TokensBatchingService.instance) {
      TokensBatchingService.instance = new TokensBatchingService();
    }
    return TokensBatchingService.instance;
  }

  private constructor() {
    this.startFlushTimer();
  }

  addTokens(
    model: string,
    provider: string,
    promptTokens: number,
    generatedTokens: number,
  ): void {
    const key = `${provider}:${model}`;

    if (!this.batches.has(key)) {
      this.batches.set(key, {
        model,
        provider,
        count: 0,
        totalPromptTokens: 0,
        totalGeneratedTokens: 0,
        lastEventTime: Date.now(),
      });
    }

    const batch = this.batches.get(key)!;
    batch.count++;
    batch.totalPromptTokens += promptTokens;
    batch.totalGeneratedTokens += generatedTokens;
    batch.lastEventTime = Date.now();

    // Flush if batch is full
    if (batch.count >= this.BATCH_SIZE_LIMIT) {
      this.flushBatch(key, batch);
    }
  }

  private flushBatch(key: string, batch: TokenBatch): void {
    if (batch.count === 0) return;

    void Telemetry.capture(
      "tokens_generated_batch",
      {
        model: batch.model,
        provider: batch.provider,
        eventCount: batch.count,
        totalPromptTokens: batch.totalPromptTokens,
        totalGeneratedTokens: batch.totalGeneratedTokens,
        avgPromptTokens: Math.round(batch.totalPromptTokens / batch.count),
        avgGeneratedTokens: Math.round(
          batch.totalGeneratedTokens / batch.count,
        ),
      },
      true,
    );

    this.batches.delete(key);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushAllBatches();
    }, this.FLUSH_INTERVAL_MS);
    // Allow the process to exit if this timer is the only thing keeping it alive
    // This prevents test hangs and allows graceful shutdown
    this.flushTimer.unref();
  }

  private flushAllBatches(): void {
    for (const [key, batch] of this.batches.entries()) {
      this.flushBatch(key, batch);
    }
  }

  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAllBatches();
  }
}
