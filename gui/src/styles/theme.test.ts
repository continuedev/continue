import { getRecursiveVar } from "./theme";

test("getRecursiveVar returns single var with default for one variable", () => {
  const vars = ["--test-var"];
  const defaultColor = "#ffffff";
  const result = getRecursiveVar(vars, defaultColor);
  expect(result).toBe("var(--test-var, #ffffff)");
});

test("getRecursiveVar returns nested vars in correct order for multiple variables", () => {
  const vars = ["--first-var", "--second-var", "--third-var"];
  const defaultColor = "#000000";
  const result = getRecursiveVar(vars, defaultColor);
  expect(result).toBe(
    "var(--first-var, var(--second-var, var(--third-var, #000000)))",
  );
});

test("getRecursiveVar handles empty vars array", () => {
  const vars: string[] = [];
  const defaultColor = "#123456";
  const result = getRecursiveVar(vars, defaultColor);
  expect(result).toBe("#123456");
});
