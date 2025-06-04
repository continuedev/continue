import { RequestOptions } from "@continuedev/config-types";
import { Response } from "node-fetch";
import { fetchwithRequestOptions } from "./fetch.js";

// Buffer accumulator that ensures proper chunk boundaries
class ChunkAccumulatorTransform implements Transformer<Uint8Array, Uint8Array> {
  private buffer: Uint8Array = new Uint8Array(0);
  private expectedChunkSize: number | null = null;
  private readonly minBufferSize = 8192; // 8KB minimum buffer

  constructor() {
    this.buffer = new Uint8Array(0);
  }

  private concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
  }

  private tryParseChunkSize(
    data: Uint8Array,
    startIndex: number,
  ): { size: number | null; endIndex: number } {
    let size = 0;
    let i = startIndex;

    // Look for the chunk size end marker
    while (i < data.length - 1) {
      // Check for CRLF
      if (data[i] === 0x0d && data[i + 1] === 0x0a) {
        return { size, endIndex: i + 2 };
      }

      // Parse hex digit
      const char = String.fromCharCode(data[i]);
      const digit = parseInt(char, 16);
      if (!isNaN(digit)) {
        size = (size << 4) | digit;
      }
      i++;
    }

    return { size: null, endIndex: startIndex };
  }

  transform(
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<Uint8Array>,
  ) {
    // Accumulate incoming data
    this.buffer = this.concatUint8Arrays(this.buffer, chunk);

    // Process buffer while we have enough data
    while (this.buffer.length > 0) {
      // If we don't have a chunk size yet, try to parse it
      if (this.expectedChunkSize === null) {
        const { size, endIndex } = this.tryParseChunkSize(this.buffer, 0);

        if (size === null) {
          // Not enough data to parse chunk size
          if (this.buffer.length > this.minBufferSize) {
            // Buffer is getting too large, flush it
            controller.enqueue(this.buffer);
            this.buffer = new Uint8Array(0);
          }
          return;
        }

        this.expectedChunkSize = size;
        this.buffer = this.buffer.slice(endIndex);
      }

      // Check if we have a complete chunk
      const expectedTotalSize = this.expectedChunkSize + 2; // +2 for CRLF
      if (this.buffer.length < expectedTotalSize) {
        return; // Wait for more data
      }

      // We have a complete chunk, emit it
      const chunk = this.buffer.slice(0, expectedTotalSize);
      controller.enqueue(chunk);

      // Keep the rest in the buffer
      this.buffer = this.buffer.slice(expectedTotalSize);
      this.expectedChunkSize = null;

      // Check for end chunk
      if (
        chunk.length >= 5 &&
        chunk[0] === 0x30 && // '0'
        chunk[1] === 0x0d && // CR
        chunk[2] === 0x0a && // LF
        chunk[3] === 0x0d && // CR
        chunk[4] === 0x0a
      ) {
        // LF
        controller.terminate();
        return;
      }
    }
  }

  flush(controller: TransformStreamDefaultController<Uint8Array>) {
    if (this.buffer.length > 0) {
      controller.enqueue(this.buffer);
    }
  }
}

/**
 * Creates a robust fetch function that handles ambiguous chunk boundaries
 */
export async function robustFetch(
  url: string,
  options?: RequestOptions,
): Promise<Response> {
  const response = await fetchwithRequestOptions(url, options);

  // Only transform chunked responses
  const transferEncoding = response.headers.get("transfer-encoding");
  if (transferEncoding?.toLowerCase().includes("chunked")) {
    const transformStream = new TransformStream(
      new ChunkAccumulatorTransform(),
    );

    // Create a new response with the transformed body
    return new Response(response.body?.pipeThrough(transformStream), {
      status: response.status,
      statusText: response.statusText,
      headers: options?.headers,
    });
  }

  return response;
}
