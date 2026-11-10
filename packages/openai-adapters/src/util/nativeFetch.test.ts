import { describe, expect, it } from "vitest";

import { withNativeFetch } from "./nativeFetch.js";

describe("withNativeFetch", () => {
  it("keeps a constructable Headers while a promised async generator is read", async () => {
    const realFetch = globalThis.fetch;
    const realHeaders = globalThis.Headers;
    const realRequest = globalThis.Request;
    const realResponse = globalThis.Response;
    const polluted = { polluted: true };
    globalThis.Headers = polluted as unknown as typeof Headers;

    try {
      const stream = withNativeFetch(() =>
        Promise.resolve(
          (async function* () {
            yield "chunk";
          })(),
        ),
      );

      let sawChunk = false;
      for await (const chunk of await stream) {
        expect(chunk).toBe("chunk");
        new globalThis.Headers();
        expect(globalThis.Headers).not.toBe(polluted);
        sawChunk = true;
      }

      expect(sawChunk).toBe(true);
      expect(globalThis.Headers).toBe(polluted);
    } finally {
      globalThis.fetch = realFetch;
      globalThis.Headers = realHeaders;
      globalThis.Request = realRequest;
      globalThis.Response = realResponse;
    }
  });

  it("restores polluted Headers before returning a sync value", () => {
    const realFetch = globalThis.fetch;
    const realHeaders = globalThis.Headers;
    const realRequest = globalThis.Request;
    const realResponse = globalThis.Response;
    const polluted = { polluted: true };
    globalThis.Headers = polluted as unknown as typeof Headers;

    try {
      const value = withNativeFetch(() => {
        new globalThis.Headers();
        expect(globalThis.Headers).not.toBe(polluted);
        return { client: true };
      });

      expect(value).toEqual({ client: true });
      expect(globalThis.Headers).toBe(polluted);
    } finally {
      globalThis.fetch = realFetch;
      globalThis.Headers = realHeaders;
      globalThis.Request = realRequest;
      globalThis.Response = realResponse;
    }
  });

  it("restores previous globals when the returned promise rejects", async () => {
    const realFetch = globalThis.fetch;
    const realHeaders = globalThis.Headers;
    const realRequest = globalThis.Request;
    const realResponse = globalThis.Response;
    const pollutedHeaders = { polluted: "headers" };
    const pollutedFetch = (() => {
      throw new Error("polluted fetch");
    }) as typeof fetch;
    const pollutedRequest = function pollutedRequest() {
      return undefined;
    };
    const pollutedResponse = function pollutedResponse() {
      return undefined;
    };

    globalThis.Headers = pollutedHeaders as unknown as typeof Headers;
    globalThis.fetch = pollutedFetch;
    globalThis.Request = pollutedRequest as unknown as typeof Request;
    globalThis.Response = pollutedResponse as unknown as typeof Response;

    try {
      const pending = withNativeFetch(() => Promise.reject(new Error("fail")));
      expect(globalThis.Headers).not.toBe(pollutedHeaders);
      expect(globalThis.fetch).not.toBe(pollutedFetch);
      expect(globalThis.Request).not.toBe(pollutedRequest);
      expect(globalThis.Response).not.toBe(pollutedResponse);

      await expect(pending).rejects.toThrow("fail");

      expect(globalThis.Headers).toBe(pollutedHeaders);
      expect(globalThis.fetch).toBe(pollutedFetch);
      expect(globalThis.Request).toBe(pollutedRequest);
      expect(globalThis.Response).toBe(pollutedResponse);
    } finally {
      globalThis.fetch = realFetch;
      globalThis.Headers = realHeaders;
      globalThis.Request = realRequest;
      globalThis.Response = realResponse;
    }
  });

  it("restores previous globals exactly once when an async iterable throws", async () => {
    const realFetch = globalThis.fetch;
    const realRequest = globalThis.Request;
    const realResponse = globalThis.Response;
    const headersDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "Headers",
    );
    const pollutedHeaders = { polluted: "headers" };
    const pollutedFetch = (() => {
      throw new Error("polluted fetch");
    }) as typeof fetch;
    const pollutedRequest = function pollutedRequest() {
      return undefined;
    };
    const pollutedResponse = function pollutedResponse() {
      return undefined;
    };

    let currentHeaders: unknown = globalThis.Headers;
    let headerRestores = 0;
    Object.defineProperty(globalThis, "Headers", {
      configurable: true,
      enumerable: headersDescriptor?.enumerable ?? false,
      get() {
        return currentHeaders;
      },
      set(value) {
        if (value === pollutedHeaders) {
          headerRestores += 1;
        }
        currentHeaders = value;
      },
    });

    globalThis.Headers = pollutedHeaders as unknown as typeof Headers;
    globalThis.fetch = pollutedFetch;
    globalThis.Request = pollutedRequest as unknown as typeof Request;
    globalThis.Response = pollutedResponse as unknown as typeof Response;
    headerRestores = 0;

    try {
      const stream = withNativeFetch(() =>
        (async function* () {
          new globalThis.Headers();
          throw new Error("stream failed");
        })(),
      );

      await expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow(
        "stream failed",
      );

      expect(globalThis.Headers).toBe(pollutedHeaders);
      expect(globalThis.fetch).toBe(pollutedFetch);
      expect(globalThis.Request).toBe(pollutedRequest);
      expect(globalThis.Response).toBe(pollutedResponse);
      expect(headerRestores).toBe(1);
    } finally {
      if (headersDescriptor) {
        Object.defineProperty(globalThis, "Headers", headersDescriptor);
      }
      globalThis.fetch = realFetch;
      globalThis.Request = realRequest;
      globalThis.Response = realResponse;
    }
  });
});
