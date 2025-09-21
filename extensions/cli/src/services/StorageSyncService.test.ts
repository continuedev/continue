import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StorageSyncService } from "./StorageSyncService.js";
import { logger } from "../util/logger.js";
import { getGitDiffSnapshot } from "../util/git.js";

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

  beforeEach(async () => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    gitDiffMock.mockReset();

    service = new StorageSyncService();
    await service.initialize();
  });

  afterEach(() => {
    service.stop();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("returns false when no storage option provided", async () => {
    const result = await service.startFromOptions({
      storageOption: undefined,
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getSessionSnapshot: vi.fn(),
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
      getSessionSnapshot: vi.fn(),
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
      getSessionSnapshot: vi.fn(),
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no Continue API key"),
    );
    warnSpy.mockRestore();
  });

  it("starts syncing when presign succeeds", async () => {
    const syncSessionHistory = vi.fn();
    const getSessionSnapshot = vi.fn().mockReturnValue({ foo: "bar" });

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
      getSessionSnapshot,
      isActive: () => true,
    });

    expect(result).toBe(true);
    expect(syncSessionHistory).toHaveBeenCalledTimes(1);
    expect(getSessionSnapshot).toHaveBeenCalledTimes(1);
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
      getSessionSnapshot: vi.fn(),
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
    });
    gitDiffMock.mockResolvedValue({ diff: "", repoFound: true });

    const warnSpy = vi.spyOn(logger, "warn");

    const result = await service.startFromOptions({
      storageOption: "session-123",
      accessToken: "token",
      syncSessionHistory: vi.fn(),
      getSessionSnapshot: vi.fn().mockReturnValue({}),
    });

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Storage upload failed"),
    );
    const state = service.getState();
    expect(state.isEnabled).toBe(true);
    expect(state.lastError).toContain("Storage upload failed");

    service.stop();
    warnSpy.mockRestore();
  });
});
