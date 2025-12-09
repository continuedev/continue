import RingBuffer from "ringbufferjs";

/**
 * CircularBuffer is a wrapper around ringbufferjs that provides
 * line-based storage with line length limits and incremental reading.
 */
export class CircularBuffer {
  private buffer: RingBuffer<string>;
  private maxLineLength: number;
  private totalLinesWritten: number = 0;

  constructor(maxLines = 10000, maxLineLength = 2000) {
    this.buffer = new RingBuffer(maxLines);
    this.maxLineLength = maxLineLength;
  }

  append(line: string): void {
    // Truncate line if too long
    const truncatedLine =
      line.length > this.maxLineLength
        ? line.substring(0, this.maxLineLength) + "..."
        : line;

    this.buffer.enq(truncatedLine);
    this.totalLinesWritten++;
  }

  getLines(fromLine?: number): string[] {
    const from = fromLine ?? 0;
    const bufferSize = this.buffer.size();

    // If buffer is empty, return empty array
    if (bufferSize === 0) {
      return [];
    }

    // Calculate the oldest line still in buffer
    const oldestLineInBuffer = this.totalLinesWritten - bufferSize;

    // If requesting lines before buffer start, clamp to start
    const effectiveFrom = Math.max(from, oldestLineInBuffer);

    // If requesting lines beyond what we've written, return empty
    if (effectiveFrom >= this.totalLinesWritten) {
      return [];
    }

    // Calculate how many lines to skip from the front and how many to return
    const skipCount = effectiveFrom - oldestLineInBuffer;
    const returnCount = this.totalLinesWritten - effectiveFrom;

    // Get all lines from buffer and slice to get the desired range
    const allLines = this.buffer.peekN(bufferSize);
    return allLines.slice(skipCount, skipCount + returnCount);
  }

  getTotalLinesWritten(): number {
    return this.totalLinesWritten;
  }

  clear(): void {
    // Empty the buffer by dequeueing all elements
    while (!this.buffer.isEmpty()) {
      this.buffer.deq();
    }
    this.totalLinesWritten = 0;
  }
}
