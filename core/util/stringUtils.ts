/**
 * General string utility functions and classes for safe string accumulation.
 */

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function plural(
  n: number,
  word: string,
  pluralWord = `${word}s`,
): string {
  return n === 1 ? word : pluralWord;
}

export function firstLineOf(s: string): string {
  const newlineIndex = s.indexOf("\n");
  return newlineIndex === -1 ? s : s.slice(0, newlineIndex);
}

export function countCharInString(
  str: { indexOf(search: string, start?: number): number },
  char: string,
  start = 0,
): number {
  let count = 0;
  let index = str.indexOf(char, start);
  while (index !== -1) {
    count++;
    index = str.indexOf(char, index + 1);
  }
  return count;
}

export function normalizeFullWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function normalizeFullWidthSpace(input: string): string {
  return input.replace(/\u3000/g, " ");
}

const MAX_STRING_LENGTH = 2 ** 25;

export function safeJoinLines(
  lines: string[],
  delimiter = ",",
  maxSize: number = MAX_STRING_LENGTH,
): string {
  const truncationMarker = "...[truncated]";
  let result = "";

  for (const line of lines) {
    const delimiterToAdd = result ? delimiter : "";
    const fullAddition = delimiterToAdd + line;

    if (result.length + fullAddition.length <= maxSize) {
      result += fullAddition;
      continue;
    }

    const remainingSpace =
      maxSize - result.length - delimiterToAdd.length - truncationMarker.length;

    if (remainingSpace > 0) {
      result +=
        delimiterToAdd + line.slice(0, remainingSpace) + truncationMarker;
    } else {
      result += truncationMarker;
    }
    return result;
  }

  return result;
}

export class EndTruncatingAccumulator {
  private content = "";
  private isTruncated = false;
  private totalBytesReceived = 0;

  constructor(private readonly maxSize: number = MAX_STRING_LENGTH) {}

  append(data: string | Buffer): void {
    const str = typeof data === "string" ? data : data.toString();
    this.totalBytesReceived += str.length;

    if (this.isTruncated && this.content.length >= this.maxSize) {
      return;
    }

    if (this.content.length + str.length > this.maxSize) {
      const remainingSpace = this.maxSize - this.content.length;
      if (remainingSpace > 0) {
        this.content += str.slice(0, remainingSpace);
      }
      this.isTruncated = true;
      return;
    }

    this.content += str;
  }

  toString(): string {
    if (!this.isTruncated) {
      return this.content;
    }
    const truncatedBytes = this.totalBytesReceived - this.maxSize;
    const truncatedKB = Math.round(truncatedBytes / 1024);
    return `${this.content}\n... [output truncated - ${truncatedKB}KB removed]`;
  }

  clear(): void {
    this.content = "";
    this.isTruncated = false;
    this.totalBytesReceived = 0;
  }

  get length(): number {
    return this.content.length;
  }

  get truncated(): boolean {
    return this.isTruncated;
  }

  get totalBytes(): number {
    return this.totalBytesReceived;
  }
}

export function truncateToLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}…`;
}
