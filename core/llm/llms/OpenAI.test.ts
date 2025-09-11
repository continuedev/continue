import OpenAI from "./OpenAI";

describe("OpenAI", () => {
  test("should identify correct o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesOrGpt5Model("o4-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o3-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o1-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o1")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o3")).toBeTruthy();

    // artificially correct samples for future models
    expect(openai.isOSeriesOrGpt5Model("o5-mini")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o6")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o77")).toBeTruthy();
    expect(openai.isOSeriesOrGpt5Model("o54-mini")).toBeTruthy();
  });
  test("should identify incorrect o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesOrGpt5Model("gpt-o4-mini")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("gpt-4.5")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("gpt-4.1")).toBeFalsy();

    // artificially wrong samples
    expect(openai.isOSeriesOrGpt5Model("os1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("so1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("ao31")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("1os")).toBeFalsy();
  });
});
