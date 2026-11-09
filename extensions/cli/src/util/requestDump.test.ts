import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { dumpRequest, redactRequest } from "./requestDump.js";

describe("redactRequest", () => {
  it("hides credential-like fields and keeps the rest", () => {
    const body = {
      model: "m",
      apiKey: "sk-live",
      "x-api-key": "k",
      authorization: "Bearer t",
      access_token: "t",
      max_tokens: 100,
      messages: [{ role: "user", content: "hi", token: "x" }],
      nested: { secretAccessKey: "s", temperature: 0.2 },
    };
    expect(redactRequest(body)).toEqual({
      model: "m",
      apiKey: "[redacted]",
      "x-api-key": "[redacted]",
      authorization: "[redacted]",
      access_token: "[redacted]",
      max_tokens: 100,
      messages: [{ role: "user", content: "hi", token: "[redacted]" }],
      nested: { secretAccessKey: "[redacted]", temperature: 0.2 },
    });
  });
});

describe("dumpRequest", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("does nothing when the directory is not set", () => {
    expect(dumpRequest({ a: 1 }, undefined)).toBeUndefined();
  });

  it("writes one redacted JSON file per request into the directory", () => {
    dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cn-dump-")), "sub");
    const first = dumpRequest({ model: "m", apiKey: "k" }, dir)!;
    const second = dumpRequest({ model: "m" }, dir)!;
    expect(first).not.toBe(second);
    expect(path.dirname(first)).toBe(dir);
    expect(path.basename(first)).toMatch(/^request-.*\.json$/);
    expect(JSON.parse(fs.readFileSync(first, "utf-8"))).toEqual({
      model: "m",
      apiKey: "[redacted]",
    });
    expect(fs.readdirSync(dir)).toHaveLength(2);
  });
});
