import { SlashCommand } from "../../index.js";
import { streamResponse } from "../../llm/stream.js";
import { removeQuotesAndEscapes } from "../../util/index.js";

const HttpSlashCommand: SlashCommand = {
  name: "http",
  description: "Call an HTTP endpoint to serve response",
  run: async function* ({ input, params, fetch }) {
    const url = params?.url;
    if (!url) {
      throw new Error("URL is not defined in params");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: removeQuotesAndEscapes(input),
      }),
    });

    // Stream the response
    if (response.body === null) {
      throw new Error("Response body is null");
    }
    for await (const chunk of streamResponse(response)) {
      yield chunk;
    }
  },
};

export default HttpSlashCommand;
