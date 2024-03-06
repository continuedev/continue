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
