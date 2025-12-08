export class CircularBuffer {
  private buffer: string[] = [];
  private maxLines: number;
  private maxLineLength: number;
  private totalLinesWritten: number = 0;
  private startIndex: number = 0; // Where the buffer logically starts

  constructor(maxLines = 10000, maxLineLength = 2000) {
    this.maxLines = maxLines;
    this.maxLineLength = maxLineLength;
  }

  append(line: string): void {
    // Truncate line if too long
    const truncatedLine =
      line.length > this.maxLineLength
        ? line.substring(0, this.maxLineLength) + "..."
        : line;

    if (this.buffer.length < this.maxLines) {
      // Buffer not full yet
      this.buffer.push(truncatedLine);
    } else {
      // Buffer is full, overwrite oldest
      const writeIndex = this.startIndex % this.maxLines;
      this.buffer[writeIndex] = truncatedLine;
      this.startIndex++;
    }

    this.totalLinesWritten++;
  }

  getLines(fromLine?: number): string[] {
    const from = fromLine ?? 0;

    // If requesting lines before buffer start, clamp to start
    const effectiveFrom = Math.max(
      from,
      this.totalLinesWritten - this.buffer.length,
    );

    // If requesting lines beyond what we've written, return empty
    if (effectiveFrom >= this.totalLinesWritten) {
      return [];
    }

    const startOffset =
      effectiveFrom - (this.totalLinesWritten - this.buffer.length);
    const endOffset =
      this.totalLinesWritten - (this.totalLinesWritten - this.buffer.length);

    // Handle circular buffer reading
    if (this.buffer.length < this.maxLines) {
      // Buffer not full yet, simple slice
      return this.buffer.slice(startOffset);
    } else {
      // Buffer is full and circular
      const physicalStart = this.startIndex % this.maxLines;
      const logicalStart = startOffset;
      const count = endOffset - startOffset;

      const result: string[] = [];
      for (let i = 0; i < count; i++) {
        const physicalIndex =
          (physicalStart + logicalStart + i) % this.maxLines;
        result.push(this.buffer[physicalIndex]);
      }
      return result;
    }
  }

  getTotalLinesWritten(): number {
    return this.totalLinesWritten;
  }

  clear(): void {
    this.buffer = [];
    this.totalLinesWritten = 0;
    this.startIndex = 0;
  }
}
