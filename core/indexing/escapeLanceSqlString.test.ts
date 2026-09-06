import { describe, expect, it } from "vitest";

import { escapeLanceSqlString } from "./escapeLanceSqlString";

describe("escapeLanceSqlString", () => {
  it("leaves strings without quotes unchanged", () => {
    expect(escapeLanceSqlString("src/normal.ts")).toBe("src/normal.ts");
  });

  it("doubles single quotes so LanceDB predicates stay valid", () => {
    expect(escapeLanceSqlString("src/don't.ts")).toBe("src/don''t.ts");
    expect(escapeLanceSqlString("it's a test/")).toBe("it''s a test/");
  });

  it("escapes multiple apostrophes", () => {
    expect(escapeLanceSqlString("a'b'c")).toBe("a''b''c");
  });
});
