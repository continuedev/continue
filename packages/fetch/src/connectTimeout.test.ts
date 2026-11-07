import { EventEmitter } from "node:events";
import * as http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { armConnectTimeout } from "./connectTimeout.js";
import { fetchwithRequestOptions } from "./fetch.js";

/** A request and the socket it is given, still connecting. */
function pendingRequest() {
  const socket = Object.assign(new EventEmitter(), { connecting: true });
  const request = Object.assign(new EventEmitter(), {
    host: "172.27.144.1",
    destroyed: undefined as Error | undefined,
    destroy: (error?: Error) => {
      request.destroyed = error;
      socket.emit("close");
    },
  });
  return { socket, request };
}

describe("armConnectTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("destroys a request whose socket does not connect in time, with ETIMEDOUT", () => {
    vi.useFakeTimers();
    const { socket, request } = pendingRequest();
    armConnectTimeout(request as any, 10_000);
    request.emit("socket", socket);
    vi.advanceTimersByTime(9_999);
    expect(request.destroyed).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(request.destroyed).toMatchObject({
      code: "ETIMEDOUT",
      message: expect.stringContaining("no answer within 10 s"),
    });
  });

  it("leaves it alone once connected, and a reused socket at once", () => {
    vi.useFakeTimers();
    const a = pendingRequest();
    armConnectTimeout(a.request as any, 1_000);
    a.request.emit("socket", a.socket);
    a.socket.emit("connect");
    const b = pendingRequest();
    b.socket.connecting = false;
    armConnectTimeout(b.request as any, 1_000);
    b.request.emit("socket", b.socket);
    vi.advanceTimersByTime(5_000);
    expect(a.request.destroyed).toBeUndefined();
    expect(b.request.destroyed).toBeUndefined();
  });

  it("does nothing without a timeout", () => {
    vi.useFakeTimers();
    const { socket, request } = pendingRequest();
    armConnectTimeout(request as any, 0);
    request.emit("socket", socket);
    vi.advanceTimersByTime(60_000);
    expect(request.destroyed).toBeUndefined();
  });
});

describe("fetchwithRequestOptions with a connect timeout", () => {
  it("still reaches a server that answers", async () => {
    const server = http.createServer((_, res) => res.end("ok"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    try {
      const res = await fetchwithRequestOptions(
        `http://127.0.0.1:${port}/`,
        {},
        { connectTimeout: 2 } as any,
      );
      expect(await res.text()).toBe("ok");
    } finally {
      server.close();
    }
  });
});
