import http from "node:http";
import { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { fetchwithRequestOptions } from "./fetch.js";
import { streamSse } from "./stream.js";

// CONTINUE_USE_WEB_FETCH=1 sends fetchwithRequestOptions through
// createWebFetch. These check what LLM requests rely on: SSE streaming,
// headers and extraBodyProperties, multipart bodies, and abort -> 499.
describe("fetchwithRequestOptions with CONTINUE_USE_WEB_FETCH=1", () => {
  let server: http.Server;
  let base: string;
  const saved: Record<string, string | undefined> = {};
  const VARS = [
    "CONTINUE_USE_WEB_FETCH",
    "HTTP_PROXY",
    "http_proxy",
    "HTTPS_PROXY",
    "https_proxy",
  ];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        if (req.url === "/sse") {
          res.setHeader("content-type", "text/event-stream");
          res.write('data: {"n":1}\n\n');
          setTimeout(() => {
            res.write('data: {"n":2}\n\n');
            res.end("data: [DONE]\n\n");
          }, 20);
          return;
        }
        if (req.url === "/echo") {
          res.setHeader("content-type", "application/json");
          return res.end(
            JSON.stringify({
              body,
              contentType: req.headers["content-type"] ?? null,
              custom: req.headers["x-custom"] ?? null,
            }),
          );
        }
        if (req.url === "/hang") return; // never answers
        res.writeHead(404);
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const v of VARS) saved[v] = process.env[v];
  });

  beforeEach(() => {
    for (const v of VARS) delete process.env[v];
    process.env.CONTINUE_USE_WEB_FETCH = "1";
  });

  afterAll(async () => {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
    await new Promise((r) => server.close(r));
  });

  test("streams server-sent events", async () => {
    const resp = await fetchwithRequestOptions(`${base}/sse`);
    const events: unknown[] = [];
    for await (const e of streamSse(resp as any)) events.push(e);
    expect(events).toEqual([{ n: 1 }, { n: 2 }]);
  });

  test("sends requestOptions headers and extraBodyProperties", async () => {
    const resp = await fetchwithRequestOptions(
      `${base}/echo`,
      {
        method: "POST",
        body: JSON.stringify({ a: 1 }),
        headers: { "content-type": "application/json" },
      },
      { headers: { "x-custom": "yes" }, extraBodyProperties: { b: 2 } },
    );
    const json = (await resp.json()) as any;
    expect(JSON.parse(json.body)).toEqual({ a: 1, b: 2 });
    expect(json.custom).toBe("yes");
  });

  test("sends FormData as multipart with its boundary", async () => {
    const form = new FormData();
    form.append("model", "whisper-1");
    const resp = await fetchwithRequestOptions(`${base}/echo`, {
      method: "POST",
      body: form as any,
    });
    const json = (await resp.json()) as any;
    expect(json.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(json.body).toContain('name="model"');
    expect(json.body).toContain("whisper-1");
  });

  test("an aborted request comes back as 499, as with node-fetch", async () => {
    const controller = new AbortController();
    const pending = fetchwithRequestOptions(`${base}/hang`, {
      signal: controller.signal as any,
    });
    setTimeout(() => controller.abort("cancel"), 20);
    const resp = await pending;
    expect(resp.status).toBe(499);
  });
});
