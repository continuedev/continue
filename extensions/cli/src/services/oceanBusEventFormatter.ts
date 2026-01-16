import type { OceanBusEvent } from "./OceanBusService.js";

/**
 * Format ocean-bus events as prompts for the LLM
 *
 * Events are formatted with clear attribution so the agent can distinguish
 * them from user input.
 */
export function formatOceanBusEvent(event: OceanBusEvent): string | null {
  const { type, data } = event;

  switch (type) {
    case "direct_message": {
      const from = data.from || "unknown";
      const threadId = data.thread_id || "unknown";
      const content = data.content || "";

      return `[Ocean-bus event: direct_message]
From: ${from}
Thread: ${threadId}
Message: "${content}"`;
    }

    case "memory_preserved": {
      const oceanUuid = data.ocean_uuid || data.ocean || "unknown";
      const memoryUuid = data.memory_uuid || data.uuid || "unknown";
      const gist = data.gist || "";

      return `[Ocean-bus event: memory_preserved]
Ocean: ${oceanUuid}
Memory: ${memoryUuid}
Gist: ${gist}`;
    }

    default:
      // Ignore other event types for now
      return null;
  }
}

/**
 * Check if an ocean-bus event should trigger autonomous response
 *
 * For direct messages, check if this ship is in the recipient list
 */
export function shouldRespondToEvent(
  event: OceanBusEvent,
  agentId: string,
): boolean {
  const { type, data } = event;

  switch (type) {
    case "direct_message": {
      const to = data.to;

      // Handle both string and array recipients
      if (typeof to === "string") {
        return to === agentId;
      }

      if (Array.isArray(to)) {
        return to.includes(agentId);
      }

      return false;
    }

    case "memory_preserved": {
      // For now, don't auto-respond to memory events
      // Could be enhanced to respond if memory is in relevant thread
      return false;
    }

    default:
      return false;
  }
}
