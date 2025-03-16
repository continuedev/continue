import { dedent } from "../util";

import { myersDiff } from "./myers";

describe("Test myers diff function", () => {
  test("should ...", () => {
    const linesA = dedent`
              A
              B
              C
              D
              E
            `;
    const linesB = dedent`
              A
              B
              C'
              D'
              E
            `;
    const diffLines = myersDiff(linesA, linesB);
    expect(diffLines).toEqual([
      { type: "same", line: "A" },
      { type: "same", line: "B" },
      { type: "old", line: "C" },
      { type: "old", line: "D" },
      { type: "new", line: "C'" },
      { type: "new", line: "D'" },
      { type: "same", line: "E" },
    ]);
  });

  test("should ignore newline differences at end", () => {
    const linesA = "A\nB\nC\n";
    const linesB = "A\nB\nC";

    const diffLines = myersDiff(linesA, linesB);
    expect(diffLines).toEqual([
      { type: "same", line: "A" },
      { type: "same", line: "B" },
      { type: "same", line: "C" },
    ]);
  });
});
