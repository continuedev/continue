import { expect, test } from "vitest";
import { BuiltInToolNames } from "./builtIn";
import { getConfigDependentToolDefinitions } from "./index";

<<<<<<< HEAD
test("searchWeb tool is only available when user is signed in", async () => {
  // Test with signed-in user
  const signedInTools = await getConfigDependentToolDefinitions({
    rules: [],
    enableExperimentalTools: false,
    isSignedIn: true,
=======
test("searchWeb tool is always available", async () => {
  const tools = await getConfigDependentToolDefinitions({
    rules: [],
    enableExperimentalTools: false,
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    isRemote: false,
    modelName: "",
    ide: {} as any,
  });

<<<<<<< HEAD
  const searchWebToolSignedIn = signedInTools.find(
    (tool) => tool.function.name === BuiltInToolNames.SearchWeb,
  );
  expect(searchWebToolSignedIn).toBeDefined();
  expect(searchWebToolSignedIn?.displayTitle).toBe("Search Web");

  // Test with non-signed-in user
  const notSignedInTools = await getConfigDependentToolDefinitions({
    rules: [],
    enableExperimentalTools: false,
    isSignedIn: false,
    isRemote: false,
    modelName: "",
    ide: {} as any,
  });

  const searchWebToolNotSignedIn = notSignedInTools.find(
    (tool) => tool.function.name === BuiltInToolNames.SearchWeb,
  );
  expect(searchWebToolNotSignedIn).toBeUndefined();
=======
  const searchWebTool = tools.find(
    (tool) => tool.function.name === BuiltInToolNames.SearchWeb,
  );
  expect(searchWebTool).toBeDefined();
  expect(searchWebTool?.displayTitle).toBe("Search Web");
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
});
