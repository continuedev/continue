// core/util/GlobalContext.test.ts
import { GlobalContext, GlobalContextType } from "./GlobalContext";
import fs from "node:fs";
import path from "path";
import { getGlobalContextFilePath } from "./paths";

describe("GlobalContext", () => {
  let globalContext: GlobalContext;
  const globalContextFilePath = getGlobalContextFilePath();

  beforeEach(() => {
    // Remove the global context file if it exists
    if (fs.existsSync(globalContextFilePath)) {
      fs.unlinkSync(globalContextFilePath);
    }
    globalContext = new GlobalContext();
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(globalContextFilePath)) {
      fs.unlinkSync(globalContextFilePath);
    }
  });

  it("should update and get a boolean value correctly", () => {
    globalContext.update("indexingPaused", true);
    const value = globalContext.get("indexingPaused");
    expect(value).toBe(true);
  });

  it("should update and get an object value correctly", () => {
    const workspaceIdentifier = "workspace-1";
    globalContext.update("lastSelectedProfileForWorkspace", {
      [workspaceIdentifier]: "profile-1",
    });

    const value = globalContext.get("lastSelectedProfileForWorkspace");
    expect(value).toEqual({ "workspace-1": "profile-1" });
  });

  it("should handle non-existent global context file gracefully on get", () => {
    const value = globalContext.get("indexingPaused");
    expect(value).toBeUndefined();
  });

  it("should handle non-existent global context file gracefully on update", () => {
    globalContext.update("indexingPaused", true);
    const value = globalContext.get("indexingPaused");
    expect(value).toBe(true);
  });

  it("should overwrite existing values", () => {
    globalContext.update("indexingPaused", true);
    expect(globalContext.get("indexingPaused")).toBe(true);

    globalContext.update("indexingPaused", false);
    expect(globalContext.get("indexingPaused")).toBe(false);
  });

  it("should handle JSON parsing errors gracefully on get", () => {
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json }");

    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const value = globalContext.get("indexingPaused");
    expect(value).toBeUndefined();
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("Error parsing global context"),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  it("should handle JSON parsing errors gracefully on update", () => {
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json }");

    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Attempt to update
    globalContext.update("indexingPaused", true);

    // The update should have been skipped due to JSON parsing error
    // So attempting to get the value should return undefined
    const value = globalContext.get("indexingPaused");
    expect(value).toBeUndefined();

    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("Error updating global context"),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  it("should update and retrieve multiple values correctly", () => {
    globalContext.update("indexingPaused", true);
    globalContext.update("hasDismissedConfigTsNoticeJetBrains", false);

    expect(globalContext.get("indexingPaused")).toBe(true);
    expect(globalContext.get("hasDismissedConfigTsNoticeJetBrains")).toBe(
      false,
    );
  });

  it("should handle updating hasAlreadyCreatedAPromptFile correctly", () => {
    globalContext.update("hasAlreadyCreatedAPromptFile", true);
    expect(globalContext.get("hasAlreadyCreatedAPromptFile")).toBe(true);
  });

  it("should not crash or throw when getting a key that hasn't been set", () => {
    expect(globalContext.get("hasAlreadyCreatedAPromptFile")).toBeUndefined();
  });
});
