import { postprocessCompletion } from "./index";

describe("postprocessCompletion - removeBackticks", () => {
  const mockLLM = { model: "test-model" } as any;

  it("should remove first line starting with ``` and last line that is ```", () => {
    const completion =
      "```typescript\nfunction hello() {\n  return 'world';\n}\n```";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("function hello() {\n  return 'world';\n}");
  });

  it("should remove only first line if it starts with ```", () => {
    const completion = "```javascript\nconst x = 5;\nconsole.log(x);";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("const x = 5;\nconsole.log(x);");
  });

  it("should remove only last line if it is ```", () => {
    const completion = "const y = 10;\nconsole.log(y);\n```";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("const y = 10;\nconsole.log(y);");
  });

  it("should not modify completion without backticks", () => {
    const completion = "function test() {\n  return true;\n}";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("function test() {\n  return true;\n}");
  });

  it("should handle completion with backticks in the middle", () => {
    const completion = "const str = `template ${literal}`;\nconsole.log(str);";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe(
      "const str = `template ${literal}`;\nconsole.log(str);",
    );
  });

  it("should handle first line with leading whitespace before ```", () => {
    const completion = "  ```python\ndef hello():\n  pass\n```";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("def hello():\n  pass");
  });

  it("should handle last line with whitespace around ```", () => {
    const completion = "```\ncode here\n  ```  ";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("code here");
  });

  it("should handle single line completion", () => {
    const completion = "const x = 5;";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("const x = 5;");
  });

  it("should handle empty completion", () => {
    const completion = "";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBeUndefined();
  });

  it("should not remove ``` if it's not on its own line at the end", () => {
    const completion = "```typescript\nconst x = 5; // end```";
    const result = postprocessCompletion({
      completion,
      llm: mockLLM,
      prefix: "",
      suffix: "",
    });
    expect(result).toBe("const x = 5; // end```");
  });
});
