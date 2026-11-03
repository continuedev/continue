import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { editYamlText, structurallyEqual } from "./yamlEdit";

const SAMPLE = `# My config
name: Local Config
version: 1.0.0
schema: v1
`;

const edit = (cb: (c: any) => any, src = SAMPLE) => editYamlText<any>(src, cb);

describe("editYamlText: file format is preserved", () => {
  it("keeps CRLF line endings", () => {
    const crlf = SAMPLE.replace(/\n/g, "\r\n");
    const { text } = edit((c) => ({ ...c, name: "Renamed" }), crlf);
    expect(text).toContain("\r\n");
    expect(text!.replace(/\r\n/g, "")).not.toContain("\n");
    expect(YAML.parse(text!).name).toBe("Renamed");
  });

  it("does not add CR to an LF file", () => {
    const { text } = edit((c) => ({ ...c, name: "Renamed" }));
    expect(text).not.toContain("\r");
  });

  it("keeps a leading BOM", () => {
    const { text } = edit(
      (c) => ({ ...c, name: "Renamed" }),
      "\uFEFF" + SAMPLE,
    );
    expect(text!.charCodeAt(0)).toBe(0xfeff);
    expect(YAML.parse(text!.slice(1)).name).toBe("Renamed");
  });

  it("an unchanged file with a BOM and CRLF reports no change", () => {
    const src = "\uFEFF" + SAMPLE.replace(/\n/g, "\r\n");
    expect(edit((c) => c, src).text).toBeUndefined();
  });

  it("keeps anchors and aliases that were not edited", () => {
    const src = `base: &base
  provider: openai
  apiKey: \${{ secrets.OPENAI_API_KEY }}
models:
  - <<: *base
    name: A
    model: gpt-5
`;
    const { text } = edit((c) => ({ ...c, name: "x" }), src);
    expect(text).toContain("&base");
    expect(text).toContain("*base");
    expect(text).toContain("name: x");
  });
});

describe("editYamlText: values", () => {
  it("treats undefined properties as absent", () => {
    expect(edit((c) => ({ ...c, extra: undefined })).text).toBeUndefined();
  });

  it("removes a key set to undefined", () => {
    const { text } = edit((c) => ({ ...c, version: undefined }));
    expect(YAML.parse(text!)).not.toHaveProperty("version");
  });

  it("keeps null as null instead of dropping it", () => {
    const { text } = edit((c) => ({ ...c, schema: null }));
    expect(YAML.parse(text!).schema).toBeNull();
  });

  it("changes a scalar's type", () => {
    const { text } = edit((c) => ({ ...c, version: 2 }));
    expect(YAML.parse(text!).version).toBe(2);
  });

  it("turns a scalar into a map and a list", () => {
    const a = edit((c) => ({ ...c, schema: { v: 1 } }));
    expect(YAML.parse(a.text!).schema).toEqual({ v: 1 });
    const b = edit((c) => ({ ...c, name: ["x", "y"] }));
    expect(YAML.parse(b.text!).name).toEqual(["x", "y"]);
  });

  it("round-trips strings that need quoting", () => {
    const tricky = ["yes", "123", "a: b", "# not a comment", "", "null"];
    const { text } = edit((c) => ({ ...c, tricky }));
    expect(YAML.parse(text!).tricky).toEqual(tricky);
  });

  it("an empty list becomes an empty list", () => {
    const { text } = edit((c) => ({ ...c, models: [] }));
    expect(YAML.parse(text!).models).toEqual([]);
  });

  it("a callback that returns a non-object is rejected, not written", () => {
    const result = edit(() => "oops" as any);
    expect(result.text).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});

describe("structurallyEqual", () => {
  it("compares deeply, ignoring undefined properties", () => {
    expect(structurallyEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(
      true,
    );
    expect(structurallyEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(structurallyEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(structurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(structurallyEqual([], {})).toBe(false);
    expect(structurallyEqual(null, undefined)).toBe(false);
    expect(structurallyEqual(NaN, NaN)).toBe(true);
  });
});
