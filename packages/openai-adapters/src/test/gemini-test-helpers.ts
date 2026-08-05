/**
 * Shared helpers for the Gemini end-to-end test rigs (proxy and TLS stubs).
 */

/** One SSE frame in the Gemini streaming response format. */
export function sseChunk(text: string, finishReason?: string): string {
  const candidate: Record<string, unknown> = {
    content: { role: "model", parts: [{ text }] },
    index: 0,
  };
  if (finishReason) {
    candidate.finishReason = finishReason;
  }
  return `data: ${JSON.stringify({ candidates: [candidate] })}\r\n\r\n`;
}
