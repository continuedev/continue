export async function* toAsyncIterable(
  nodeReadable: NodeJS.ReadableStream,
): AsyncGenerator<Uint8Array> {
  for await (const chunk of nodeReadable) {
    // @ts-ignore
    yield chunk as Uint8Array;
  }
}

export async function* streamResponse(
  response: Response,
): AsyncGenerator<string> {
  if (response.status === 499) {
    return; // In case of client-side cancellation, just return
  }

  if (response.status !== 200) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("No response body returned.");
  }

  // Get the major version of Node.js
  const nodeMajorVersion = parseInt(process.versions.node.split(".")[0], 10);
  let chunks = 0;

  try {
    if (nodeMajorVersion >= 20) {
      // Use the new API for Node 20 and above
      const stream = (ReadableStream as any).from(response.body);
      for await (const chunk of stream.pipeThrough(
        new TextDecoderStream("utf-8"),
      )) {
        yield chunk;
        chunks++;
      }
    } else {
      // Fallback for Node versions below 20
      // Streaming with this method doesn't work as version 20+ does
      const decoder = new TextDecoder("utf-8");
      const nodeStream = response.body as unknown as NodeJS.ReadableStream;
      for await (const chunk of toAsyncIterable(nodeStream)) {
        yield decoder.decode(chunk, { stream: true });
        chunks++;
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.name.startsWith("AbortError")) {
        return; // In case of client-side cancellation, just return
      }
      if (e.message.toLowerCase().includes("premature close")) {
        // Premature close can happen for various reasons, including:
        // - Malformed chunks of data received from the server
        // - The server closed the connection before sending the complete response
        // - Long delays from the server during streaming
        // - 'Keep alive' header being used in combination with an http agent and a set, low number of maxSockets
        if (chunks === 0) {
          throw new Error(
            "Stream was closed before any data was received. Try again. (Premature Close)",
          );
        } else {
          throw new Error(
            "The response was cancelled mid-stream. Try again. (Premature Close).",
          );
        }
      }
    }
    throw e;
  }
}

// Export for testing purposes
export function parseDataLine(line: string): any {
  const json = line.startsWith("data: ")
    ? line.slice("data: ".length)
    : line.slice("data:".length);

  try {
    const data = JSON.parse(json);
    if (data.error) {
      if (
        data.error &&
        typeof data.error === "object" &&
        "message" in data.error
      ) {
        console.error("Error in streamed response:", data.error);
        throw new Error(`Error streaming response: ${data.error.message}`);
      }
      throw new Error(
        `Error streaming response: ${JSON.stringify(data.error)}`,
      );
    }

    return data;
  } catch (e) {
    // If the error was thrown by our error check, rethrow it
    if (
      e instanceof Error &&
      e.message.startsWith("Error streaming response:")
    ) {
      throw e;
    }
    // Otherwise it's a JSON parsing error
    throw new Error(`Malformed JSON sent from server: ${json}`);
  }
}

function parseSseLine(line: string): { done: boolean; data: any } {
  if (line.startsWith("data:[DONE]") || line.startsWith("data: [DONE]")) {
    return { done: true, data: undefined };
  }
  if (line.startsWith("data:")) {
    return { done: false, data: parseDataLine(line) };
  }
  if (line.startsWith(": ping")) {
    return { done: true, data: undefined };
  }
  return { done: false, data: undefined };
}

export async function* streamSse(response: Response): AsyncGenerator<any> {
  let buffer = "";
  for await (const value of streamResponse(response)) {
    buffer += value;

    let position: number;
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

export async function* streamJSON(response: Response): AsyncGenerator<any> {
  let buffer = "";
  for await (const value of streamResponse(response)) {
    buffer += value;

    let position;
    while ((position = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, position);
      try {
        const data = JSON.parse(line);
        yield data;
      } catch (e) {
        throw new Error(`Malformed JSON sent from server: ${line}`);
      }
      buffer = buffer.slice(position + 1);
    }
  }
}
