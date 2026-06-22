import OpenAI from "./OpenAI";

describe("OpenAI", () => {
  test("should identify correct o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
<<<<<<< HEAD
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
=======
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
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  });
  test("should identify incorrect o-series models", () => {
    const openai = new OpenAI({
      model: "o3-mini",
    });
<<<<<<< HEAD
    expect(openai.isOSeriesOrGpt5Model("gpt-o4-mini")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("gpt-4.5")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("gpt-4.1")).toBeFalsy();

    // artificially wrong samples
    expect(openai.isOSeriesOrGpt5Model("os1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("so1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("ao31")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5Model("1os")).toBeFalsy();
=======
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-o4-mini")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-4.5")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("gpt-4.1")).toBeFalsy();

    // artificially wrong samples
    expect(openai.isOSeriesOrGpt5PlusModel("os1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("so1")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("ao31")).toBeFalsy();
    expect(openai.isOSeriesOrGpt5PlusModel("1os")).toBeFalsy();
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
  });
});
