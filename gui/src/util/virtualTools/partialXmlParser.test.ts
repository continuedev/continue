import { parsePartialXml } from "./partialXmlParser";

describe("PartialXMLParser", () => {
  test("parses simple XML tag with content", () => {
    const result = parsePartialXml("<person>John</person>");
    expect(result).toEqual({ person: "John" });
  });

  test("parses nested XML tags", () => {
    const result = parsePartialXml(
      "<person><name>John</name><age>30</age></person>",
    );
    expect(result).toEqual({
      person: {
        name: "John",
        age: "30",
      },
    });
  });

  test("handles partial XML input - unclosed tag", () => {
    const result = parsePartialXml("<person><name>John</name><age>");
    expect(result).toEqual({
      person: {
        name: "John",
      },
    });
  });

  test("handles partial XML input - incomplete tag name", () => {
    const result = parsePartialXml("<person><name>John</name><a");
    expect(result).toEqual({
      person: {
        name: "John",
      },
    });
  });

  test("handles partial XML input - incomplete closing tag", () => {
    const result = parsePartialXml("<person><name>John</name");
    expect(result).toEqual({
      person: {
        name: "John",
      },
    });
  });

  test("returns null when no valid XML", () => {
    const result = parsePartialXml("Just some text");
    expect(result).toBeNull();
  });

  test("handles whitespace correctly", () => {
    const result = parsePartialXml(
      "<person>\n  <name>  John  </name>\n</person>",
    );
    expect(result).toEqual({
      person: {
        name: "John",
      },
    });
  });

  test("handles empty input ending with opening bracket", () => {
    const result = parsePartialXml("<");
    expect(result).toEqual({});
  });

  test("handles empty input ending with partial tag", () => {
    const result = parsePartialXml("<per");
    expect(result).toEqual({});
  });

  test("processes each chunk independently", () => {
    const chunk1 = parsePartialXml("<person><name");
    expect(chunk1).toEqual({
      person: {},
    });

    const chunk2 = parsePartialXml("<person><name>John</name></person>");
    expect(chunk2).toEqual({
      person: {
        name: "John",
      },
    });
  });
});
