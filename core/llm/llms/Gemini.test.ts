import { describe, it, expect } from "@jest/globals";
import Gemini from "./Gemini";

describe("Gemini processGeminiResponse", () => {
  it("should preserve square brackets in content", async () => {
    const gemini = new Gemini({
      apiKey: "test-key",
      model: "gemini-pro",
    });

    // Simulate a streaming response with square brackets in the content
    const mockStream = async function* () {
      // Simulating chunks as they might arrive from Gemini API
      yield '[{"candidates":[{"content":{"parts":[{"text":"Here is an array: [1, 2, 3]"}],"role":"model"}]}]';
    };

    const messages: any[] = [];
    for await (const message of gemini.processGeminiResponse(mockStream())) {
      messages.push(message);
    }

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toEqual([
      { type: "text", text: "Here is an array: [1, 2, 3]" },
    ]);
  });

  it("should preserve square brackets in chunked content", async () => {
    const gemini = new Gemini({
      apiKey: "test-key",
      model: "gemini-pro",
    });

    // Simulate a streaming response arriving in multiple chunks
    const mockStream = async function* () {
      yield '[{"candidates":[{"content":{"';
      yield 'parts":[{"text":"Use [this] syntax"}]';
      yield ',"role":"model"}]}]';
    };

    const messages: any[] = [];
    for await (const message of gemini.processGeminiResponse(mockStream())) {
      messages.push(message);
    }

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toEqual([
      { type: "text", text: "Use [this] syntax" },
    ]);
  });

  it("should handle multiple response chunks with square brackets", async () => {
    const gemini = new Gemini({
      apiKey: "test-key",
      model: "gemini-pro",
    });

    // Simulate multiple response objects in the stream
    const mockStream = async function* () {
      yield '[{"candidates":[{"content":{"parts":[{"text":"First [part]"}],"role":"model"}]},';
      yield '\n,{"candidates":[{"content":{"parts":[{"text":" second [part]"}],"role":"model"}]}]';
    };

    const messages: any[] = [];
    for await (const message of gemini.processGeminiResponse(mockStream())) {
      messages.push(message);
    }

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toEqual([
      { type: "text", text: "First [part]" },
    ]);
    expect(messages[1].content).toEqual([
      { type: "text", text: " second [part]" },
    ]);
  });
});
