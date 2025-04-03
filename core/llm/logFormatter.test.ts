import { Buffer } from "buffer";
import { Writable } from "stream";
import { LLMLogFormatter } from "./logFormatter";
import { LLMLogger } from "./logger";

class MemoryWritable extends Writable {
  data: Buffer[] = [];
  constructor() {
    super();
    this.data = [];
  }

  _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.data.push(chunk);
    callback();
  }

  getText() {
    const decoder = new TextDecoder();
    return decoder.decode(Buffer.concat(this.data as any));
  }
}

describe("LLMLogFormatter", () => {
  it("should format log items correctly", () => {
    const logger = new LLMLogger();
    const output = new MemoryWritable();
    const formatter = new LLMLogFormatter(logger, output);

    logger._logItem({
      interactionId: "1",
      timestamp: 1698765432100,
      kind: "startChat",
      options: {
        model: "granite3.2-dense:8b",
      },
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant",
        },
      ],
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433100,
      kind: "message",
      message: {
        role: "assistant",
        content: "Hello, ",
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433200,
      kind: "message",
      message: {
        role: "assistant",
        content: "world!",
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433300,
      kind: "message",
      message: {
        role: "assistant",
        content: "\nHow can I help you?",
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765434100,
      kind: "success",
      promptTokens: 10,
      generatedTokens: 20,
      thinkingTokens: 0,
    });

    expect(output.getText()).toBe(
      [
        " 15:17:12.1 [Chat]",
        "            Options: {",
        '              "model": "granite3.2-dense:8b"',
        "            }",
        "            Role: system",
        "            | You are a helpful assistant",
        "       +1.0 Role: assistant",
        "            | Hello, world!",
        "       +1.2 | How can I help you?",
        "       +2.0 Success",
        "            Prompt Tokens: 10",
        "            Generated Tokens: 20",
        "",
      ].join("\n"),
    );
  });

  it("should format completion interactions correctly", () => {
    const logger = new LLMLogger();
    const output = new MemoryWritable();
    const formatter = new LLMLogFormatter(logger, output);

    logger._logItem({
      interactionId: "1",
      timestamp: 1698765432100,
      kind: "startComplete",
      options: {
        model: "granite3.2-dense:8b",
      },
      prompt: "A horse is a horse",
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433100,
      kind: "chunk",
      chunk: ", of course, of course",
    });

    expect(output.getText()).toBe(
      [
        " 15:17:12.1 [Complete]",
        "            Options: {",
        '              "model": "granite3.2-dense:8b"',
        "            }",
        "            Prompt:",
        "            | A horse is a horse",
        "       +1.0 Result:",
        "            | , of course, of course",
      ].join("\n"),
    );
  });

  it("should format FIM interactions correctly", () => {
    const logger = new LLMLogger();
    const output = new MemoryWritable();
    const formatter = new LLMLogFormatter(logger, output);

    logger._logItem({
      interactionId: "1",
      timestamp: 1698765432100,
      kind: "startFim",
      options: {
        model: "granite3.2-dense:8b",
      },
      prefix: "A\nB",
      suffix: "D\nE",
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433100,
      kind: "chunk",
      chunk: "C",
    });

    expect(output.getText()).toBe(
      [
        " 15:17:12.1 [Fim]",
        "            Options: {",
        '              "model": "granite3.2-dense:8b"',
        "            }",
        "            Prefix:",
        "            | A",
        "            | B",
        "            Suffix:",
        "            | D",
        "            | E",
        "       +1.0 Result:",
        "            | C",
      ].join("\n"),
    );
  });

  it("should interleave log items correctly", () => {
    const logger = new LLMLogger();
    const output = new MemoryWritable();
    const formatter = new LLMLogFormatter(logger, output);

    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433100,
      kind: "message",
      message: {
        role: "assistant",
        content: "Hello, ",
      },
    });
    logger._logItem({
      interactionId: "2",
      timestamp: 1698765433200,
      kind: "message",
      message: {
        role: "assistant",
        content: "Hello, ",
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433300,
      kind: "message",
      message: {
        role: "assistant",
        content: "World!",
      },
    });
    logger._logItem({
      interactionId: "2",
      timestamp: 1698765433400,
      kind: "message",
      message: {
        role: "assistant",
        content: "World!",
      },
    });
    // Check if we end interaction 2 and start another interaction,
    // it gets a different prefix marker.
    logger._logItem({
      interactionId: "2",
      timestamp: 1698765434000,
      kind: "success",
      promptTokens: 10,
      generatedTokens: 20,
      thinkingTokens: 0,
    });
    logger._logItem({
      interactionId: "3",
      timestamp: 1698765434100,
      kind: "message",
      message: {
        role: "assistant",
        content: "Hello, World!",
      },
    });

    expect(output.getText()).toBe(
      [
        " 15:17:13.1 Role: assistant",
        "            | Hello, ",
        "|15:17:13.2 Role: assistant",
        "|           | Hello, ",
        "       +0.2 | World!",
        "|      +0.2 | World!",
        "|      +0.8 Success",
        "|           Prompt Tokens: 10",
        "|           Generated Tokens: 20",
        "&15:17:14.1 Role: assistant",
        "&           | Hello, World!",
      ].join("\n"),
    );
  });

  it("should wrap long lines", () => {
    const logger = new LLMLogger();
    const output = new MemoryWritable();
    const formatter = new LLMLogFormatter(logger, output, 40);

    // Test a single message long enough to wrap; the input is
    // "<xx...xx>", not "xxxx" to make sure we are writing the correct
    // substrings.
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433100,
      kind: "message",
      message: {
        role: "assistant",
        content: "<" + "x".repeat(58) + ">",
      },
    });
    // Test when a first message doesn't wrap, but another message
    // that continues the same line causes a wrap
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433200,
      kind: "message",
      message: {
        role: "assistant",
        content: "\n<" + "y".repeat(29),
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433300,
      kind: "message",
      message: {
        role: "assistant",
        content: "y".repeat(29) + ">",
      },
    });
    logger._logItem({
      interactionId: "1",
      timestamp: 1698765433400,
      kind: "message",
      message: {
        role: "assistant",
        content: "\n" + "Artichokes and Beans ".repeat(3),
      },
    });

    expect(output.getText()).toBe(
      [
        " 15:17:13.1 Role: assistant",
        "            | <" + "x".repeat(39),
        "            . " + "x".repeat(19) + ">",
        "       +0.1 | <" + "y".repeat(39),
        "       +0.2 . " + "y".repeat(19) + ">",
        "       +0.3 | Artichokes and Beans Artichokes and",
        "            . Beans Artichokes and Beans ",
      ].join("\n"),
    );
  });
});
