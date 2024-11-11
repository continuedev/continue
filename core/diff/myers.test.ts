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
    console.log(diffLines);
  });
});
