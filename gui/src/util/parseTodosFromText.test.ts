import { describe, expect, it } from "vitest";
import parseTodosFromText from "./parseTodosFromText";

describe("parseTodosFromText", () => {
  it("parses plain JSON with todos array", () => {
    const input = JSON.stringify({
      summary: "S",
      todos: [
        { text: "a", order: 1 },
        { text: "b", order: 2 },
      ],
      actions: [],
    });

    const res = parseTodosFromText(input);
    expect(res).not.toBeNull();
    expect(res?.todos.length).toBe(2);
    expect(res?.todos[0].text).toBe("a");
  });

  it("parses markdown fenced JSON", () => {
    const input = '```json\n{ \n  "todos": ["x", "y"]\n}\n```';
    const res = parseTodosFromText(input);
    expect(res).not.toBeNull();
    expect(res?.todos[0].text).toBe("x");
  });

  it("returns null for non-json content", () => {
    const res = parseTodosFromText("just some text without json");
    expect(res).toBeNull();
  });

  it("parses todos as array of strings", () => {
    const input = JSON.stringify({ todos: ["one", "two"] });
    const res = parseTodosFromText(input);
    expect(res).not.toBeNull();
    expect(res?.todos[1].text).toBe("two");
    expect(res?.todos[1].order).toBe(2);
  });
});
