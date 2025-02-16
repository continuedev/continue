import { BaseLlmApi, constructLlmApi } from "../index.js";
import { LLMConfig } from "../types.js";

export function getLlmApi(config: LLMConfig) {
  const api = constructLlmApi(config);
  if (!api) {
    throw new Error("Failed to construct LLM");
  }
  return api;
}

export function testEmbed(api: BaseLlmApi, model: string) {
  test("should successfully embed", async () => {
    const response = await api.embed({
      model,
      input: ["This is a test", "Hello world!"],
    });
    expect(response.model).toBe(model);
    expect(response.object).toBe("list");
    expect(response.data.length).toEqual(2);
    response.data.forEach((val, index) => {
      expect(val.index).toBe(index);
      expect(val.object).toBe("embedding");
      expect(val.embedding.some((v) => typeof v !== "number")).toBe(false);
    });
  });
}

export function testRerank(api: BaseLlmApi, model: string) {
  test("should successfully rerank", async () => {
    const response = await api.rerank({
      model: model,
      query: "What is the capital of spain?",
      documents: [
        "The capital of spain is Madrid",
        "The largest breed of dog is the Great Dane",
      ],
    });
    expect(response.model).toBe(model);
    expect(response.object).toBe("list");
    expect(response.data.length).toEqual(2);
    response.data.forEach((val, index) => {
      expect(val.index).toBe(index);
      expect(typeof val.relevance_score).toBe("number");
    });
    expect(response.data[0].relevance_score).toBeGreaterThan(
      response.data[1].relevance_score,
    );
  });
}

export function testFim(api: BaseLlmApi, model: string) {
  test("should successfully fim", async () => {
    const response = api.fimStream(
      {
        model: model,
        prompt: "This is a ",
        suffix: " .",
        stream: true,
      },
      new AbortController().signal,
    );

    let completion = "";
    for await (const result of response) {
      expect(result.choices.length).toBeGreaterThan(0);
      expect(typeof result.choices[0].delta.content).toBe("string");

      completion += result.choices[0].delta.content;
    }

    expect(completion.length).toBeGreaterThan(0);
  });
}

export function testChat(api: BaseLlmApi, model: string) {
  test("should successfully stream chat", async () => {
    const stream = api.chatCompletionStream(
      {
        model,
        messages: [{ role: "user", content: "Hello! Who are you?" }],
        stream: true,
      },
      new AbortController().signal,
    );
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].delta.content ?? "";

      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test("should successfully stream multi-part chat with empty text", async () => {
    const stream = api.chatCompletionStream(
      {
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello! Who are you?",
              },
              {
                // @ts-ignore
                type: "text",
                text: "",
              },
            ],
          },
        ],
        stream: true,
      },
      new AbortController().signal,
    );
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].delta.content ?? "";

      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test.skip("should successfully stream multi-part chat with image", async () => {
    const stream = api.chatCompletionStream(
      {
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hello! Who are you?",
              },
              {
                // @ts-ignore
                type: "image_url",
                image_url: {
                  url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Image_created_with_a_mobile_phone.png/1280px-Image_created_with_a_mobile_phone.png",
                  detail: "low",
                },
              },
            ],
          },
        ],
        stream: true,
      },
      new AbortController().signal,
    );
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].delta.content ?? "";

      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test("should successfully non-stream chat", async () => {
    const response = await api.chatCompletionNonStream(
      {
        model,
        messages: [{ role: "user", content: "Hello! Who are you?" }],
        stream: false,
      },
      new AbortController().signal,
    );

    expect(response.choices.length).toBeGreaterThan(0);

    const completion = response.choices[0].message.content;
    expect(typeof completion).toBe("string");
    expect(completion?.length).toBeGreaterThan(0);
  });

  test("should acknowledge system message in chat", async () => {
    const response = await api.chatCompletionNonStream(
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "Regardless of what is asked of you, your answer should start with 'RESPONSE: '.",
          },
          { role: "user", content: "Who are you?" },
        ],
        stream: false,
      },
      new AbortController().signal,
    );
    expect(response.choices.length).toBeGreaterThan(0);
    const completion = response.choices[0].message.content;
    expect(typeof completion).toBe("string");
    expect(completion?.length).toBeGreaterThan(0);
    expect(completion?.startsWith("RESPONSE: ")).toBe(true);
  });
}

export function testCompletion(api: BaseLlmApi, model: string) {
  test("should successfully stream complete", async () => {
    const stream = api.completionStream(
      {
        model: model,
        prompt: "Hello! Who are you?",
        stream: true,
      },
      new AbortController().signal,
    );
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].text ?? "";

      expect(typeof result.choices[0].text).toBe("string");
      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test("should successfully non-stream complete", async () => {
    const response = await api.completionNonStream(
      {
        model,
        prompt: "Hello! Who are you?",
        stream: false,
      },
      new AbortController().signal,
    );

    expect(response.choices.length).toBeGreaterThan(0);

    const completion = response.choices[0].text;
    expect(typeof completion).toBe("string");
    expect(completion.length).toBeGreaterThan(0);
  });
}
