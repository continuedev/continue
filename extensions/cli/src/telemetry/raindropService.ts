import { logger } from "../util/logger.js";

let raindropClient: any = null;

export async function initialize(): Promise<void> {
  const writeKey = process.env.RAINDROP_WRITE_KEY;
  if (!writeKey) {
    return;
  }

  try {
    // Route OpenAI/Anthropic through AI SDK path
    process.env.CONTINUE_USE_AI_SDK = "true";

    const { createRaindropAISDK } = await import("@raindrop-ai/ai-sdk");
    const ai = await import("ai");
    const { setAiModuleOverride } = await import(
      "@continuedev/openai-adapters"
    );

    raindropClient = createRaindropAISDK({ writeKey });

    const wrapped = raindropClient.wrap(ai, {
      context: {
        userId: process.env.USER ?? "unknown",
        eventName: "cli-completion",
      },
    });

    // Merge wrapped functions over the original ai module
    setAiModuleOverride({ ...ai, ...wrapped });

    logger.debug("Raindrop observability initialized");
  } catch (err) {
    logger.debug("Raindrop initialization failed (non-critical)", err as any);
  }
}

export async function shutdown(): Promise<void> {
  if (!raindropClient) {
    return;
  }

  try {
    await raindropClient.shutdown();
  } catch (err) {
    logger.debug("Raindrop shutdown error (ignored)", err as any);
  }
}
