export async function* onlyWhitespaceAfterEndOfLine(
  stream: AsyncGenerator<string>,
  endOfLine: string[],
): AsyncGenerator<string> {
  let pending = "";
  for await (let chunk of stream) {
    chunk = pending + chunk;
    pending = "";
    for (let i = 0; i < chunk.length - 1; i++) {
      if (
        endOfLine.includes(chunk[i]) &&
        chunk[i + 1].trim() === chunk[i + 1]
      ) {
        yield chunk.slice(0, i + 1);
        return;
      }
    }
    if (endOfLine.includes(chunk[chunk.length - 1])) {
      pending = chunk[chunk.length - 1];
      yield chunk.slice(0, chunk.length - 1);
    } else {
      yield chunk;
    }
  }
  yield pending;
}

export async function* noFirstCharNewline(stream: AsyncGenerator<string>) {
  let first = true;
  for await (const char of stream) {
    if (first) {
      first = false;
      if (char === "\n") {
        return;
      }
    }
    yield char;
  }
}

const BRACKETS: { [key: string]: string } = { "(": ")", "{": "}", "[": "]" };
const BRACKETS_REVERSE: { [key: string]: string } = {
  ")": "(",
  "}": "{",
  "]": "[",
};
export async function* stopOnUnmatchedClosingBracket(
  stream: AsyncGenerator<string>,
  suffix: string,
): AsyncGenerator<string> {
  // Add corresponding open brackets from suffix to stack
  const stack: string[] = [];
  for (let i = 0; i < suffix.length; i++) {
    if (suffix[i] === " ") continue;
    const openBracket = BRACKETS_REVERSE[suffix[i]];
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
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      if (Object.values(BRACKETS).includes(char)) {
        // It's a closing bracket
        if (stack.length === 0 || BRACKETS[stack.pop()!] !== char) {
          // If the stack is empty or the top of the stack doesn't match the current closing bracket
          yield chunk.slice(0, i);
          return; // Stop the generator if the closing bracket doesn't have a matching opening bracket in the stream
        }
      } else if (Object.keys(BRACKETS).includes(char)) {
        // It's an opening bracket
        stack.push(char);
      }
    }
    yield chunk;
  }
}
