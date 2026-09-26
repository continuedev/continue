import { describe, expect, it, vi } from "vitest";

import {
  createAuthMiddleware,
  getServeAuthToken,
  getServeHost,
} from "./serveSecurity.js";

describe("serveSecurity", () => {
  it("defaults host to 127.0.0.1", () => {
    expect(getServeHost({})).toBe("127.0.0.1");
    expect(getServeHost({ host: "0.0.0.0" })).toBe("0.0.0.0");
  });

  it("handles getServeAuthToken correctly", () => {
    expect(getServeAuthToken({ noAuth: true })).toBeNull();
    expect(
      getServeAuthToken({ authToken: "custom-secret" }),
    ).toBe("custom-secret");
    const generated = getServeAuthToken({});
    expect(generated).toBeTruthy();
    expect(generated!.length).toBeGreaterThan(16);
  });

  it("creates middleware that verifies authorization", () => {
    const middleware = createAuthMiddleware("test-secret");

    const unauthReq: any = { headers: {}, query: {} };
    const resMock: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const nextMock = vi.fn();

    middleware(unauthReq, resMock, nextMock);
    expect(resMock.status).toHaveBeenCalledWith(401);
    expect(nextMock).not.toHaveBeenCalled();

    const authReq: any = {
      headers: { authorization: "Bearer test-secret" },
      query: {},
    };
    middleware(authReq, resMock, nextMock);
    expect(nextMock).toHaveBeenCalled();
  });
});
