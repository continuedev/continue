import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OpenAIApi } from "../apis/OpenAI.js";

// openai 7 refuses to build a client without credentials. Keyless providers
// (Ollama, LM Studio, ...) must still work, without sending a fake token.
describe("OpenAIApi without an API key", () => {
  let server: http.Server;
  let base: string;
  const seen: (string | undefined)[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push(req.headers.authorization);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ object: "list", data: [] }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("constructs and sends no Authorization header", async () => {
    const api = new OpenAIApi({ provider: "openai", apiBase: base });
    await api.list();
    expect(seen.pop()).toBeUndefined();
  });

  it("sends the key when one is configured", async () => {
    const api = new OpenAIApi({
      provider: "openai",
      apiBase: base,
      apiKey: "sk-test",
    });
    await api.list();
    expect(seen.pop()).toBe("Bearer sk-test");
  });
});
