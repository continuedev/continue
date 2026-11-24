import { describe, expect, it } from "vitest";
import { providers } from "./providers";

describe("NanoGPT model setup", () => {
  it("offers a coding preset with tools and a matching context limit", () => {
    const preset = providers.nanogpt!.packages[0];
    expect(preset.params).toMatchObject({
      model: "deepseek/deepseek-v4.1-flash",
      contextLength: 1048576,
      capabilities: { tools: true },
    });
    expect(providers.nanogpt!.provider).toBe("nanogpt");
    // AddModelForm spreads input values over the preset, even when unset.
    // Keep optional context inputs from erasing the preset's context limit.
    expect(
      providers.nanogpt!.collectInputFor!.map(({ key }) => key),
    ).not.toContain("contextLength");
  });

  it("offers the four coding-page alternatives without changing their model IDs", () => {
    expect(
      providers.nanogpt!.packages.slice(1, 5).map(({ params }) => params.model),
    ).toEqual([
      "z-ai/glm-5.3-flash",
      "moonshotai/kimi-k2.6",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-opus-5.5",
    ]);
    for (const preset of providers.nanogpt!.packages.slice(0, 5)) {
      expect(preset.params.capabilities).toEqual({
        tools: true,
        uploadImage: true,
      });
    }
  });

  it("requires a key, offers discovery, and does not require a base URL", () => {
    expect(providers.nanogpt!.collectInputFor).toContainEqual(
      expect.objectContaining({
        key: "apiKey",
        inputType: "password",
        required: true,
      }),
    );
    expect(
      providers.nanogpt!.collectInputFor!.some(
        ({ key, required }) => key === "apiBase" && required,
      ),
    ).toBe(false);
    expect(
      providers.nanogpt!.packages.some(
        ({ params }) => params.model === "AUTODETECT",
      ),
    ).toBe(true);
  });
});
