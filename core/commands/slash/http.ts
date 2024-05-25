import { SlashCommand } from "../../index.js";
import { removeQuotesAndEscapes } from "../../util/index.js";

const HttpSlashCommand: SlashCommand = {
  name: "http",
  description: "Call an HTTP endpoint to serve response",
  run: async function* ({ ide, llm, input, params, fetch }) {
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
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const decoded = new TextDecoder("utf-8").decode(value);
      yield decoded;
    }
  },
};

export default HttpSlashCommand;
