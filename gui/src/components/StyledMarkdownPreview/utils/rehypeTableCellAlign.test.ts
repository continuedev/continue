import { describe, expect, it } from "vitest";
import { rehypeTableCellAlign } from "./rehypeTableCellAlign";

const cell = (tagName: string, properties: Record<string, unknown>) => ({
  type: "element",
  tagName,
  properties,
  children: [{ type: "text", value: "x" }],
});

const run = (...cells: any[]) => {
  const tree = { type: "root", children: cells };
  rehypeTableCellAlign()(tree);
  return tree.children.map((c: any) => c.properties);
};

describe("rehypeTableCellAlign", () => {
  it("drops a null align so no style string is generated", () => {
    expect(
      run(cell("th", { align: null }), cell("td", { align: null })),
    ).toEqual([{}, {}]);
  });

  it("turns an alignment into a style object", () => {
    expect(
      run(
        cell("th", { align: "left" }),
        cell("td", { align: "center" }),
        cell("td", { align: "right" }),
      ),
    ).toEqual([
      { style: { textAlign: "left" } },
      { style: { textAlign: "center" } },
      { style: { textAlign: "right" } },
    ]);
  });

  it("ignores unknown alignments and other elements", () => {
    expect(
      run(cell("td", { align: "bogus" }), cell("p", { align: "left" })),
    ).toEqual([{}, { align: "left" }]);
  });
});
