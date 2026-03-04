import { createHash } from "crypto";

import { logger } from "../util/logger.js";

let raindropClient: any = null;

function getAnonymousUserId(): string {
  const raw = process.env.USER ?? process.env.USERNAME ?? "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export async function initialize(): Promise<void> {
  const writeKey = process.env.RAINDROP_WRITE_KEY;
  if (!writeKey) {
    return;
  }

  try {
    const { createRaindropAISDK } = await import("@raindrop-ai/ai-sdk");
    const ai = await import("ai");
    const { setAiModuleOverride } = await import(
      "@continuedev/openai-adapters"
    );

    raindropClient = createRaindropAISDK({ writeKey });

    const wrapped = raindropClient.wrap(ai, {
      context: {
        userId: getAnonymousUserId(),
        eventName: "cli-completion",
      },
    });

    // Merge wrapped functions over the original ai module
    setAiModuleOverride({ ...ai, ...wrapped });

    // Only route through AI SDK path after successful init
    process.env.CONTINUE_USE_AI_SDK = "true";

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
