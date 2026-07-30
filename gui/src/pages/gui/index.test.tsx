import { readFileSync } from "node:fs";

test("sidebar shell allows flex children to shrink horizontally", () => {
  const source = readFileSync("src/pages/gui/index.tsx", "utf8");

  expect(source).toMatch(/<div className="[^"]*\bmin-w-0\b[^"]*">/);
  expect(source).toMatch(/<main className="[^"]*\bmin-w-0\b[^"]*">/);
});
