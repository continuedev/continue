import OpenAI from "./OpenAI";

describe("OpenAI", () => {
  test("should identify correct o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesModel("o4-mini")).toBeTruthy();
    expect(openai.isOSeriesModel("o3-mini")).toBeTruthy();
    expect(openai.isOSeriesModel("o1-mini")).toBeTruthy();
    expect(openai.isOSeriesModel("o1")).toBeTruthy();
    expect(openai.isOSeriesModel("o3")).toBeTruthy();

    // artificially correct samples for future models
    expect(openai.isOSeriesModel("o5-mini")).toBeTruthy();
    expect(openai.isOSeriesModel("o6")).toBeTruthy();
    expect(openai.isOSeriesModel("o77")).toBeTruthy();
    expect(openai.isOSeriesModel("o54-mini")).toBeTruthy();
  });
  test("should identify incorrect o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
    expect(openai.isOSeriesModel("gpt-o4-mini")).toBeFalsy();
    expect(openai.isOSeriesModel("gpt-4.5")).toBeFalsy();
    expect(openai.isOSeriesModel("gpt-4.1")).toBeFalsy();

    // artificially wrong samples
    expect(openai.isOSeriesModel("os1")).toBeFalsy();
    expect(openai.isOSeriesModel("so1")).toBeFalsy();
    expect(openai.isOSeriesModel("ao31")).toBeFalsy();
    expect(openai.isOSeriesModel("1os")).toBeFalsy();
  });
});
