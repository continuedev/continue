import { fetchwithRequestOptions } from "@continuedev/fetch";
import { beforeEach, expect, test, vi } from "vitest";
import type { RequestOptions } from "../../index.js";
import { ContinueServerClient } from "./client.js";

vi.mock("@continuedev/fetch");

const requestOptions: RequestOptions = {
  proxy: "http://proxy.example.com:8080",
  verifySsl: false,
};

beforeEach(() => {
  vi.mocked(fetchwithRequestOptions).mockResolvedValue({
    ok: true,
    json: async () => ({ configJson: "{}" }),
  } as any);
});

test("getConfig forwards requestOptions to the fetch layer", async () => {
  const client = new ContinueServerClient(
    "https://server.example.com",
    "token",
    requestOptions,
  );

  await client.getConfig();

  expect(fetchwithRequestOptions).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({ method: "GET" }),
    requestOptions,
  );
});

test("getFromIndexCache forwards requestOptions to the fetch layer", async () => {
  vi.mocked(fetchwithRequestOptions).mockResolvedValue({
    ok: true,
    json: async () => ({ files: {} }),
  } as any);

  const client = new ContinueServerClient(
    "https://server.example.com",
    "token",
    requestOptions,
  );

  await client.getFromIndexCache(["key"], "embeddings" as any, "repo");

  expect(fetchwithRequestOptions).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({ method: "POST" }),
    requestOptions,
  );
});
