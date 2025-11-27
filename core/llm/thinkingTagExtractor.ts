/**
 * Helper class to extract thinking content from custom tags during streaming.
 * This is used for providers like vLLM that support custom thinking output formats.
 */
export class ThinkingTagExtractor {
  private buffer: string = "";
  private inThinkingBlock: boolean = false;
  private readonly openTag: string;
  private readonly closeTag: string;

  constructor(openTag: string, closeTag: string) {
    this.openTag = openTag;
    this.closeTag = closeTag;
  }

  /**
   * Process a chunk of text and extract thinking/regular content.
   * Returns an object with the thinking content and regular content that should be yielded.
   */
  process(text: string): {
    thinking: string;
    content: string;
  } {
    this.buffer += text;

    let thinking = "";
    let content = "";

    while (this.buffer.length > 0) {
      if (this.inThinkingBlock) {
        // Look for closing tag
        const closeIndex = this.buffer.indexOf(this.closeTag);
        if (closeIndex !== -1) {
          // Found closing tag - extract thinking content up to it
          thinking += this.buffer.substring(0, closeIndex);
          this.buffer = this.buffer.substring(
            closeIndex + this.closeTag.length,
          );
          this.inThinkingBlock = false;
        } else {
          // No closing tag yet - check if we might have a partial closing tag at the end
          const partialMatchLength = this.getPartialMatchLength(
            this.buffer,
            this.closeTag,
          );
          if (partialMatchLength > 0) {
            // Keep the potential partial match in the buffer
            thinking += this.buffer.substring(
              0,
              this.buffer.length - partialMatchLength,
            );
            this.buffer = this.buffer.substring(
              this.buffer.length - partialMatchLength,
            );
          } else {
            // No partial match - all content is thinking
            thinking += this.buffer;
            this.buffer = "";
          }
          break;
        }
      } else {
        // Not in thinking block - look for opening tag
        const openIndex = this.buffer.indexOf(this.openTag);
        if (openIndex !== -1) {
          // Found opening tag
          content += this.buffer.substring(0, openIndex);
          this.buffer = this.buffer.substring(openIndex + this.openTag.length);
          this.inThinkingBlock = true;
        } else {
          // No opening tag - check if we might have a partial opening tag at the end
          const partialMatchLength = this.getPartialMatchLength(
            this.buffer,
            this.openTag,
          );
          if (partialMatchLength > 0) {
            // Keep the potential partial match in the buffer
            content += this.buffer.substring(
              0,
              this.buffer.length - partialMatchLength,
            );
            this.buffer = this.buffer.substring(
              this.buffer.length - partialMatchLength,
            );
          } else {
            // No partial match - all content is regular content
            content += this.buffer;
            this.buffer = "";
          }
          break;
        }
      }
    }

    return { thinking, content };
  }

  /**
   * Flush any remaining content in the buffer.
   * Call this when the stream ends.
   */
  flush(): {
    thinking: string;
    content: string;
  } {
    const result = {
      thinking: this.inThinkingBlock ? this.buffer : "",
      content: this.inThinkingBlock ? "" : this.buffer,
    };
    this.buffer = "";
    this.inThinkingBlock = false;
    return result;
  }

  /**
   * Check if the end of the text could be the start of the tag.
   * Returns the length of the partial match, or 0 if no match.
   */
  private getPartialMatchLength(text: string, tag: string): number {
    for (let i = 1; i < tag.length && i <= text.length; i++) {
      if (text.slice(-i) === tag.slice(0, i)) {
        return i;
      }
    }
    return 0;
  }
}
