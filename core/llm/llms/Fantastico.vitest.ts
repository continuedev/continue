import { describe, expect, it, vi } from "vitest";

import Fantastico from "./Fantastico";

function mockModels(fantastico: Fantastico) {
  return vi.spyOn(fantastico, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        models: [{ id: "anthropic/claude-sonnet-4.5" }, { id: "openai/gpt-5" }],
      }),
    ),
  );
}

describe("Fantastico", () => {
  it("should have correct provider name", () => {
    expect(Fantastico.providerName).toBe("fantastico");
  });

  it("should default to the production control plane", () => {
    expect(Fantastico.defaultOptions.apiBase).toBe(
      "https://fantastico.cc/api/",
    );
  });

  it("should list models from /edge/models with an account key", async () => {
    const fantastico = new Fantastico({
      model: "AUTODETECT",
      apiKey: "ck-fant-test",
    });
    const fetchSpy = mockModels(fantastico);

    const models = await fantastico.listModels();

    expect(models).toEqual(["anthropic/claude-sonnet-4.5", "openai/gpt-5"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://fantastico.cc/api/edge/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer ck-fant-test" },
      }),
    );
  });

  it("should list models from /runtime/models with a project key", async () => {
    const fantastico = new Fantastico({
      model: "AUTODETECT",
      apiKey: "sk-fant-test",
      apiBase: "https://fantastico.example/api",
    });
    const fetchSpy = mockModels(fantastico);

    await fantastico.listModels();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://fantastico.example/api/runtime/models",
      expect.anything(),
    );
  });
});
