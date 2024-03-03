export async function* streamResponse(
  response: Response,
): AsyncGenerator<string> {
  if (response.status !== 200) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error(`No response body returned.`);
  }

  const stream = response.body as any;

  const decoder = new TextDecoder("utf-8");

  for await (const chunk of stream) {
    yield decoder.decode(chunk);
  }
}

function parseDataLine(line: string): any {
  const json = line.startsWith("data: ")
    ? line.slice("data: ".length)
    : line.slice("data:".length);

  try {
    const data = JSON.parse(json);
    if (data.error) {
      throw new Error(`Error streaming response: ${data.error}`);
    }

    return data;
  } catch (e) {
    throw new Error(`Malformed JSON sent from server: ${json}`);
  }
}

function parseSseLine(line: string): { done: boolean; data: any } {
  if (line.startsWith("data: [DONE]")) {
    return { done: true, data: undefined };
  } else if (line.startsWith("data:")) {
    return { done: false, data: parseDataLine(line) };
  } else if (line.startsWith(": ping")) {
    return { done: true, data: undefined };
  }
  return { done: false, data: undefined };
}

export async function* streamSse(response: Response): AsyncGenerator<any> {
  let buffer = "";
  for await (const value of streamResponse(response)) {
    buffer += value;

    let position;
    while ((position = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, position);
      buffer = buffer.slice(position + 1);

      const { done, data } = parseSseLine(line);
      if (done) {
        break;
      }
      if (data) {
        yield data;
      }
    }
  }

  if (buffer.length > 0) {
    const { done, data } = parseSseLine(buffer);
    if (!done && data) {
      yield data;
    }
  }
}
