import { fetchwithRequestOptions } from "@continuedev/fetch";
import { afterEach, describe, expect, it, vi } from "vitest";

import Mistral from "./Mistral.js";

vi.mock("@continuedev/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@continuedev/fetch")>()),
  fetchwithRequestOptions: vi.fn(),
}));
vi.mock("../../data/devdataSqlite.js", () => ({ DevDataSqliteDb: {} }));
vi.mock("../../data/log.js", () => ({ DataLogger: {} }));
vi.mock("../../util/Logger.js", () => ({ Logger: {} }));
vi.mock("../countTokens.js", () => ({
  compileChatMessages: vi.fn(),
  countTokens: vi.fn(),
  pruneRawPromptFromTop: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(fetchwithRequestOptions).mockReset();
});

describe("Mistral API key autodetection", () => {
  it.each([
    [200, "https://api.mistral.ai/v1/"],
    [401, "https://codestral.mistral.ai/v1/"],
  ])(
    "honors request options and detects the endpoint for HTTP %s",
    async (status, apiBase) => {
      vi.mocked(fetchwithRequestOptions).mockResolvedValue(
        new Response(null, { status }) as any,
      );
      const adapterSpy = vi.spyOn(
        Mistral.prototype as any,
        "createOpenAiAdapter",
      );
      const requestOptions = {
        proxy: "http://proxy.example.com:8080",
        verifySsl: false,
      };
      const llm = new Mistral({
        model: "mistral-small",
        apiKey: "test-key",
        requestOptions,
      });

      await vi.waitFor(() => expect(adapterSpy).toHaveBeenCalledTimes(2));

      expect(llm.apiBase).toBe(apiBase);
      expect(fetchwithRequestOptions).toHaveBeenCalledWith(
        "https://api.mistral.ai/v1/models",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
        requestOptions,
      );
    },
  );

  it("keeps an explicitly configured endpoint without autodetection", () => {
    const llm = new Mistral({
      model: "mistral-small",
      apiKey: "test-key",
      apiBase: "https://custom.example.com/v1/",
    });

    expect(llm.apiBase).toBe("https://custom.example.com/v1/");
    expect(fetchwithRequestOptions).not.toHaveBeenCalled();
  });
});
