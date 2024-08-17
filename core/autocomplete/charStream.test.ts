import { jest } from "@jest/globals";
import * as charStream from "./charStream";
import { Typescript } from "./languages";

describe("charStream", () => {
  let mockFullStop: jest.Mock;

  async function getCharGenerator(chars: string[]) {
    return (async function* () {
      for (const char of chars) {
        yield char;
      }
    })();
  }

  async function getFilteredChars(results: AsyncGenerator<string>) {
    const output = [];
    for await (const char of results) {
      output.push(char);
    }
    return output;
  }

  beforeEach(() => {
    mockFullStop = jest.fn();
  });

  describe("onlyWhitespaceAfterEndOfLine", () => {
    const endOfLineChar = Typescript.endOfLine[0];

    it("should stop at end of line if non-whitespace follows", async () => {
      const charGenerator = await getCharGenerator([
        `Hello${endOfLineChar}World`,
      ]);

      const result = charStream.onlyWhitespaceAfterEndOfLine(
        charGenerator,
        [endOfLineChar],
        mockFullStop,
      );
      const filteredChars = await getFilteredChars(result);

      expect(filteredChars.join("")).toBe(`Hello${endOfLineChar}`);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });

    it("should continue past end of line if only whitespace follows", async () => {
      const charGenerator = await getCharGenerator([
        `Hello${endOfLineChar}  World`,
      ]);
      const result = charStream.onlyWhitespaceAfterEndOfLine(
        charGenerator,
        [endOfLineChar],
        mockFullStop,
      );
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe(`Hello${endOfLineChar}  World`);
      expect(mockFullStop).not.toHaveBeenCalled();
    });

    it("should handle end of line at the end of chunk", async () => {
      const charGenerator = await getCharGenerator([
        `Hello${endOfLineChar}`,
        "World",
      ]);
      const result = charStream.onlyWhitespaceAfterEndOfLine(
        charGenerator,
        [endOfLineChar],
        mockFullStop,
      );
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe(`Hello${endOfLineChar}`);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });
  });

  describe("noFirstCharNewline", () => {
    it("should remove leading newline", async () => {
      const charGenerator = await getCharGenerator(["\nHello"]);
      const result = charStream.noFirstCharNewline(charGenerator);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("");
    });

    it("should keep content if no leading newline", async () => {
      const charGenerator = await getCharGenerator(["Hello\nWorld"]);
      const result = charStream.noFirstCharNewline(charGenerator);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("Hello\nWorld");
    });

    it("should remove leading carriage return", async () => {
      const charGenerator = await getCharGenerator(["\rHello"]);
      const result = charStream.noFirstCharNewline(charGenerator);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("");
    });
  });

  describe("stopAtStopTokens", () => {
    it("should stop at the first occurrence of a stop token", async () => {
      const charGenerator = await getCharGenerator(["Hello<|endoftext|>World"]);
      const result = charStream.stopAtStopTokens(charGenerator, [
        "<|endoftext|>",
      ]);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("Hello");
    });

    it("should return all content if no stop tokens are provided", async () => {
      const charGenerator = await getCharGenerator(["Hello<|endoftext|>World"]);
      const result = charStream.stopAtStopTokens(charGenerator, []);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("Hello<|endoftext|>World");
    });

    it("should handle stop tokens that span multiple chunks", async () => {
      const charGenerator = await getCharGenerator([
        "Hello<|",
        "endoftext|>World",
      ]);
      const result = charStream.stopAtStopTokens(charGenerator, [
        "<|endoftext|>",
      ]);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("Hello");
    });

    it("should yield remaining characters in buffer if no stop token is found", async () => {
      const charGenerator = await getCharGenerator(["Hello", "World"]);
      const result = charStream.stopAtStopTokens(charGenerator, [
        "<|endoftext|>",
      ]);
      const filteredChars = await getFilteredChars(result);
      expect(filteredChars.join("")).toBe("HelloWorld");
    });
  });
});
