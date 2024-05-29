/**
 * We follow the policy of only completing bracket pairs that we started
 * But sometimes we started the pair in a previous autocomplete suggestion
 */
export class BracketMatchingService {
  private openingBracketsFromLastCompletion: string[] = [];
  private lastCompletionFile: string | undefined = undefined;

  static BRACKETS: { [key: string]: string } = { "(": ")", "{": "}", "[": "]" };
  static BRACKETS_REVERSE: { [key: string]: string } = {
    ")": "(",
    "}": "{",
    "]": "[",
  };

  handleAcceptedCompletion(completion: string, filepath: string) {
    this.openingBracketsFromLastCompletion = [];
    const stack: string[] = [];

    for (let i = 0; i < completion.length; i++) {
      const char = completion[i];
      if (Object.keys(BracketMatchingService.BRACKETS).includes(char)) {
        // It's an opening bracket
        stack.push(char);
      } else if (
        Object.values(BracketMatchingService.BRACKETS).includes(char)
      ) {
        // It's a closing bracket
        if (
          stack.length === 0 ||
          BracketMatchingService.BRACKETS[stack.pop()!] !== char
        ) {
          break;
        }
      }
    }

    // Any remaining opening brackets in the stack are uncompleted
    this.openingBracketsFromLastCompletion = stack;
    this.lastCompletionFile = filepath;
  }

  async *stopOnUnmatchedClosingBracket(
    stream: AsyncGenerator<string>,
    suffix: string,
    filepath: string,
  ): AsyncGenerator<string> {
    // Add opening brackets from the previous response
    let stack: string[] = [];
    if (this.lastCompletionFile === filepath) {
      stack = [...this.openingBracketsFromLastCompletion];
    } else {
      this.lastCompletionFile = undefined;
    }

    // Add corresponding open brackets from suffix to stack
    for (let i = 0; i < suffix.length; i++) {
      if (suffix[i] === " ") continue;
      const openBracket = BracketMatchingService.BRACKETS_REVERSE[suffix[i]];
      if (!openBracket) break;
      stack.unshift(openBracket);
    }

    let all = "";
    let seenNonWhitespaceOrClosingBracket = false;
    for await (let chunk of stream) {
      // Allow closing brackets before any non-whitespace characters
      if (!seenNonWhitespaceOrClosingBracket) {
        const firstNonWhitespaceOrClosingBracketIndex =
          chunk.search(/[^\s\)\}\]]/);
        if (firstNonWhitespaceOrClosingBracketIndex !== -1) {
          yield chunk.slice(0, firstNonWhitespaceOrClosingBracketIndex);
          chunk = chunk.slice(firstNonWhitespaceOrClosingBracketIndex);
          seenNonWhitespaceOrClosingBracket = true;
        } else {
          yield chunk;
          continue;
        }
      }

      all += chunk;
      const allLines = all.split("\n");
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i];
        if (Object.values(BracketMatchingService.BRACKETS).includes(char)) {
          // It's a closing bracket
          if (
            stack.length === 0 ||
            BracketMatchingService.BRACKETS[stack.pop()!] !== char
          ) {
            // If the stack is empty or the top of the stack doesn't match the current closing bracket
            yield chunk.slice(0, i);
            return; // Stop the generator if the closing bracket doesn't have a matching opening bracket in the stream
          }
        } else if (
          Object.keys(BracketMatchingService.BRACKETS).includes(char)
        ) {
          // It's an opening bracket
          stack.push(char);
        }
      }
      yield chunk;
    }
  }
}
