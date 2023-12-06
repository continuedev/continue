import { LLM } from "..";
import { ChatMessage, CompletionOptions } from "../types";
import axios from "axios";

// const SERVER_URL = "http://127.0.0.1:8080"
const SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app";

class FreeTrial extends LLM {
  private _getHeaders() {
    return { uniqueId: this.uniqueId || "None" };
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    const args = this.collectArgs(options);

    const response = await axios.post(
      `${SERVER_URL}/complete`,
      {
        messages: [{ role: "user", content: prompt }],
        ...args,
      },
      {
        headers: this._getHeaders(),
        //   proxy: this.requestOptions.proxy,
      }
    );

    if (response.status != 200) {
      throw new Error(response.data);
    }

    return response.data;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    const args = this.collectArgs(options);

    const response = await axios.post(
      `${SERVER_URL}/stream_complete`,
      {
        messages: [{ role: "user", content: prompt }],
        ...args,
      },
      {
        headers: this._getHeaders(),
        responseType: "stream",
        //   proxy: this.requestOptions.proxy,
      }
    );

    if (response.status != 200) {
      throw new Error(await streamToString(response.data));
    }

    for await (const chunk of response.data) {
      if (chunk) {
        let decodedChunk = chunk.toString("utf-8");
        yield decodedChunk;
      }
    }
  }
}

async function* streamChat(messages: ChatMessage[], options: any) {
  const args = this.collectArgs(options);

  const response = await axios.post(
    `${SERVER_URL}/stream_chat`,
    {
      messages,
      ...args,
    },
    {
      headers: this.getHeaders(),
      // proxy: requestOptions.proxy,
      responseType: "stream",
    }
  );

  if (response.status !== 200) {
    throw new Error(await streamToString(response.data));
  }

  for await (const chunk of response.data) {
    if (chunk) {
      const jsonChunk = chunk.toString("utf-8");
      const chunks = jsonChunk.split("\n");

      for (const chunk of chunks) {
        if (chunk.trim() !== "") {
          const loadedChunk = JSON.parse(chunk);

          yield {
            role: "assistant",
            content: loadedChunk.content || "",
          };

          if (this.model === "gpt-4") {
            await delay(0.03);
          } else {
            await delay(0.01);
          }
        }
      }
    }
  }
}

async function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function streamToString(stream: any) {
  let decoder = new TextDecoder("utf-8");
  let result = "";
  for await (const chunk of stream) {
    result += decoder.decode(chunk);
  }
  return result;
}

export default FreeTrial;
