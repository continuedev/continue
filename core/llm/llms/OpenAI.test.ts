import { ChatMessage, CompletionOptions } from "../../index.js";
import OpenAI from "./OpenAI";

class TestOpenAI extends OpenAI {
  convertArgsResponses(options: CompletionOptions, messages: ChatMessage[]) {
    return this._convertArgsResponses(options, messages);
  }
}

describe("OpenAI", () => {
  test("omits temperature from Responses API requests unless configured", () => {
    const openai = new TestOpenAI({ model: "gpt-5" });
    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    const baseOptions = { model: "gpt-5" } as CompletionOptions;

    expect(
      openai.convertArgsResponses(baseOptions, messages),
    ).not.toHaveProperty("temperature");
    expect(
      openai.convertArgsResponses({ ...baseOptions, temperature: 0 }, messages),
    ).toHaveProperty("temperature", 0);
  });

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
});
