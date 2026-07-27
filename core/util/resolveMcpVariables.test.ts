import { homedir } from "os";
import { resolveMcpVariables } from "./resolveMcpVariables";

const context = { workspaceDir: "/Users/test/my-project" };

test("resolves ${workspaceFolder}", () => {
  expect(resolveMcpVariables("${workspaceFolder}", context)).toBe(
    "/Users/test/my-project",
  );
});

test("resolves ${workspaceFolder} as a path prefix", () => {
  expect(resolveMcpVariables("${workspaceFolder}/src", context)).toBe(
    "/Users/test/my-project/src",
  );
});

test("resolves ${workspaceFolder} with a surrounding prefix", () => {
  expect(resolveMcpVariables("prefix-${workspaceFolder}", context)).toBe(
    "prefix-/Users/test/my-project",
  );
});

test("resolves ${workspaceFolderBasename}", () => {
  expect(resolveMcpVariables("${workspaceFolderBasename}", context)).toBe(
    "my-project",
  );
});

test("resolves ${userHome}", () => {
  expect(resolveMcpVariables("${userHome}", context)).toBe(homedir());
});

test("resolves ${env:VAR} from provided env", () => {
  expect(
    resolveMcpVariables("${env:HOME}", {
      ...context,
      env: { HOME: "/home/x" },
    }),
  ).toBe("/home/x");
});

test("resolves ${env:VAR} from provided env for another variable name", () => {
  expect(
    resolveMcpVariables("${env:USERNAME}", {
      ...context,
      env: { USERNAME: "onkar" },
    }),
  ).toBe("onkar");
});

test("leaves unknown variables unchanged", () => {
  expect(resolveMcpVariables("${notAVariable}", context)).toBe(
    "${notAVariable}",
  );
});

test("variable names are case-sensitive, matching VS Code's own variable syntax", () => {
  expect(resolveMcpVariables("${WorkspaceFolder}", context)).toBe(
    "${WorkspaceFolder}",
  );
  expect(resolveMcpVariables("${WORKSPACEFOLDER}", context)).toBe(
    "${WORKSPACEFOLDER}",
  );
  expect(resolveMcpVariables("${UserHome}", context)).toBe("${UserHome}");
});

test("leaves ${env:VAR} unchanged when the env var is unset", () => {
  expect(
    resolveMcpVariables("${env:DOES_NOT_EXIST}", { ...context, env: {} }),
  ).toBe("${env:DOES_NOT_EXIST}");
});

test("leaves Continue's ${{ secrets.X }} template syntax unchanged", () => {
  expect(resolveMcpVariables("${{ secrets.MY_TOKEN }}", context)).toBe(
    "${{ secrets.MY_TOKEN }}",
  );
});

test("resolves variables inside nested arrays", () => {
  expect(
    resolveMcpVariables(
      ["${workspaceFolder}", ["${userHome}", "literal"]],
      context,
    ),
  ).toEqual(["/Users/test/my-project", [homedir(), "literal"]]);
});

test("resolves variables inside nested objects", () => {
  expect(
    resolveMcpVariables(
      {
        PROJECT_DIR: "${workspaceFolder}",
        nested: { HOME: "${userHome}" },
      },
      context,
    ),
  ).toEqual({
    PROJECT_DIR: "/Users/test/my-project",
    nested: { HOME: homedir() },
  });
});

test("resolves a cwd value", () => {
  expect(resolveMcpVariables("${workspaceFolder}", context)).toBe(
    "/Users/test/my-project",
  );
});

test("resolves an args array", () => {
  expect(
    resolveMcpVariables(
      ["${workspaceFolder}", "${workspaceFolder}/src"],
      context,
    ),
  ).toEqual(["/Users/test/my-project", "/Users/test/my-project/src"]);
});

test("resolves an env object", () => {
  expect(
    resolveMcpVariables(
      { PROJECT_DIR: "${workspaceFolder}", HOME: "${userHome}" },
      context,
    ),
  ).toEqual({ PROJECT_DIR: "/Users/test/my-project", HOME: homedir() });
});

test("leaves ${workspaceFolder} unchanged when no workspace dir is known", () => {
  expect(resolveMcpVariables("${workspaceFolder}", {})).toBe(
    "${workspaceFolder}",
  );
});

test("passes through non-string primitives and undefined", () => {
  expect(resolveMcpVariables(undefined, context)).toBeUndefined();
  expect(resolveMcpVariables(42, context)).toBe(42);
});
