import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGitDiffSnapshot } from "../util/git.js";
import { logger } from "../util/logger.js";

import { StorageSyncService } from "./StorageSyncService.js";

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../env.js", () => ({
  env: { apiBase: "https://api.test/" },
}));

vi.mock("../util/git.js", () => ({
  getGitDiffSnapshot: vi.fn(),
}));

describe("StorageSyncService", () => {
  const fetchMock = vi.fn();
  const gitDiffMock = vi.mocked(getGitDiffSnapshot);
  let service: StorageSyncService;
  let originalFetch: typeof fetch | undefined;
  let hadFetch = false;

  beforeEach(async () => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    hadFetch = "fetch" in globalThis;
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    gitDiffMock.mockReset();

    service = new StorageSyncService();
    await service.initialize();
  });

  afterEach(() => {
    service.stop();
    if (hadFetch) {
      globalThis.fetch = originalFetch!;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
  });

  it("returns false when no storage option provided", async () => {
    const result = await service.startFromOptions({
      storageOption: undefined,
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getCompleteStateSnapshot: vi.fn(),
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("warns when storage identifier trims to empty", async () => {
    const warnSpy = vi.spyOn(logger, "warn");

    const result = await service.startFromOptions({
      storageOption: "   ",
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getCompleteStateSnapshot: vi.fn(),
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("storage identifier was empty"),
    );
    warnSpy.mockRestore();
  });

  it("warns when storage requested without access token", async () => {
    const warnSpy = vi.spyOn(logger, "warn");

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: null,
      syncSessionHistory: vi.fn(),
      getCompleteStateSnapshot: vi.fn(),
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no Continue API key"),
    );
    warnSpy.mockRestore();
  });

  it("starts syncing when presign succeeds", async () => {
    const syncSessionHistory = vi.fn();
    const getCompleteStateSnapshot = vi.fn().mockReturnValue({ foo: "bar" });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { putUrl: "https://upload/session", key: "session.json" },
        diff: { putUrl: "https://upload/diff", key: "diff.txt" },
      }),
    });
    fetchMock.mockResolvedValue({ ok: true });
    gitDiffMock.mockResolvedValue({ diff: "diff", repoFound: true });

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory,
      getCompleteStateSnapshot,
      isActive: () => true,
    });

    expect(result).toBe(true);
    expect(syncSessionHistory).toHaveBeenCalledTimes(1);
    expect(getCompleteStateSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [presignUrl, presignOptions] = fetchMock.mock.calls[0];
    expect(presignUrl).toBeInstanceOf(URL);
    expect((presignUrl as URL).toString()).toBe(
      "https://api.test/agents/storage/presigned-url",
    );
    expect(presignOptions).toMatchObject({ method: "POST" });

    const [sessionUrl, sessionOptions] = fetchMock.mock.calls[1];
    expect(sessionUrl).toBe("https://upload/session");
    expect(sessionOptions).toMatchObject({
      method: "PUT",
      body: expect.any(String),
    });

    service.stop();
    expect(service.getState().isEnabled).toBe(false);
  });

  it("returns false when presign request fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    const warnSpy = vi.spyOn(logger, "warn");
    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getCompleteStateSnapshot: vi.fn(),
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("presign request failed"),
    );
    expect(service.getState().lastError).toBe(
      "Failed to obtain presigned URLs",
    );
    warnSpy.mockRestore();
  });

  it("records upload error details when PUT fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { putUrl: "https://upload/session", key: "session.json" },
        diff: { putUrl: "https://upload/diff", key: "diff.txt" },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Access denied",
    });
    gitDiffMock.mockResolvedValue({ diff: "", repoFound: true });

    const warnSpy = vi.spyOn(logger, "warn");

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getCompleteStateSnapshot: vi.fn().mockReturnValue({}),
    });

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Storage sync upload failed"),
    );
    const state = service.getState();
    expect(state.isEnabled).toBe(true);
    expect(state.lastError).toContain("Storage upload failed");

    service.stop();
    warnSpy.mockRestore();
  });

  it("does nothing when markAgentStatusUnread has no storage context", async () => {
    await service.markAgentStatusUnread();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the agent session as unread", async () => {
    (service as unknown as { options: any }).options = {
      storageId: "session-123",
      accessToken: "token",
    };

    fetchMock.mockResolvedValueOnce({ ok: true });

    await service.markAgentStatusUnread();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).toString()).toBe(
      "https://api.test/agents/session-123/read-status",
    );
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ unread: true }),
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
    });
  });

  it("includes server-side encryption header when required by signed headers", async () => {
    const syncSessionHistory = vi.fn();
    const getCompleteStateSnapshot = vi.fn().mockReturnValue({ test: "data" });

    // Mock presign response with server-side encryption in signed headers
    const sessionUrlWithSSE =
      "https://upload/session?X-Amz-SignedHeaders=host%3Bx-amz-server-side-encryption";
    const diffUrl = "https://upload/diff";

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { putUrl: sessionUrlWithSSE, key: "session.json" },
        diff: { putUrl: diffUrl, key: "diff.txt" },
      }),
    });
    fetchMock.mockResolvedValue({ ok: true });
    gitDiffMock.mockResolvedValue({ diff: "test diff", repoFound: true });

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory,
      getCompleteStateSnapshot,
      isActive: () => true,
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Check session upload includes server-side encryption header
    const sessionCall = fetchMock.mock.calls[1];
    expect(sessionCall[0]).toBe(sessionUrlWithSSE);
    expect(sessionCall[1]).toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-amz-server-side-encryption": "AES256",
      },
    });

    service.stop();
  });

  it("refreshes URLs on 403 error", async () => {
    const syncSessionHistory = vi.fn();
    const getCompleteStateSnapshot = vi.fn().mockReturnValue({ test: "data" });

    // Mock initial presign success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { putUrl: "https://upload/session-old", key: "session.json" },
        diff: { putUrl: "https://upload/diff-old", key: "diff.txt" },
      }),
    });

    // Mock 403 upload failure
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Request has expired",
    });

    // Mock refresh presign success
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { putUrl: "https://upload/session-new", key: "session.json" },
        diff: { putUrl: "https://upload/diff-new", key: "diff.txt" },
      }),
    });

    gitDiffMock.mockResolvedValue({ diff: "test", repoFound: true });

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory,
      getCompleteStateSnapshot,
      isActive: () => true,
    });

    expect(result).toBe(true);

    // Wait for async refresh
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchMock).toHaveBeenCalledTimes(3); // presign + failed upload + refresh
    expect(service.getState().isEnabled).toBe(true);

    service.stop();
  });

  it("prevents concurrent refresh requests", async () => {
    const syncSessionHistory = vi.fn();
    const getCompleteStateSnapshot = vi.fn().mockReturnValue({});

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { putUrl: "https://upload/session", key: "session.json" },
        diff: { putUrl: "https://upload/diff", key: "diff.txt" },
      }),
    });

    await service.start({
      storageId: "session-123",
      accessToken: "token",
      syncSessionHistory,
      getCompleteStateSnapshot,
    });

    const refreshMethod = (service as any).refreshStorageTargets.bind(service);
    const results = await Promise.all([
      refreshMethod(),
      refreshMethod(),
      refreshMethod(),
    ]);

    const successCount = results.filter((r) => r === true).length;
    expect(successCount).toBe(1); // Only first succeeds

    service.stop();
  });
});
