import OpenAI from "./OpenAI";

describe("OpenAI", () => {
  test("should identify correct o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesOrGpt5PlusModel("o4-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o3-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o1-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o1")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o3")).toBeTruthy();

    // artificially correct samples for future models
    expect(openai.isOSeriesOrGpt5PlusModel("o5-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o6")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o77")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("o54-mini")).toBeTruthy();

    // gpt-5+ models
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-5")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-5.4")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-5.4-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-5.4-pro")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-6")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-7-turbo")).toBeTruthy();
  });
  test("should identify incorrect o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-o4-mini")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-4.5")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-4.1")).toBeFalsy();

    // artificially wrong samples
    expect(openai.isOSeriesOrGpt5PlusModel("os1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("so1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("ao31")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("1os")).toBeFalsy();
  });

  describe("canUseOpenAIResponses", () => {
    test("should use responses on official OpenAI apiBase for o-series model", () => {
      const openai = new OpenAI({
        model: "o3-mini",
        apiKey: "test",
      });
      expect((openai as any).canUseOpenAIResponses({ model: "o3-mini" })).toBe(
        true,
      );
    });

    test("should not use responses on custom apiBase by default", () => {
      const openai = new OpenAI({
        model: "o3-mini",
        apiKey: "test",
        apiBase: "https://custom.openai-proxy.com/v1/",
      });
      expect((openai as any).canUseOpenAIResponses({ model: "o3-mini" })).toBe(
        false,
      );
    });

    test("should allow forcing responses on custom apiBase when useResponsesApi is true", () => {
      const openai = new OpenAI({
        model: "o3-mini",
        apiKey: "test",
        apiBase: "https://custom.openai-proxy.com/v1/",
        useResponsesApi: true,
      });
      expect((openai as any).canUseOpenAIResponses({ model: "o3-mini" })).toBe(
        true,
      );
    });

    test("should disable responses when useResponsesApi is false", () => {
      const openai = new OpenAI({
        model: "o3-mini",
        apiKey: "test",
        apiBase: "https://api.openai.com/v1",
        useResponsesApi: false,
      });
      expect((openai as any).canUseOpenAIResponses({ model: "o3-mini" })).toBe(
        false,
      );
    });
  });
});
