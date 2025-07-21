// core/util/GlobalContext.test.ts
import fs from "node:fs";
import { GlobalContext } from "./GlobalContext";
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
      expect.stringContaining(
        "Error parsing global context, deleting corrupted file",
      ),
    );

    // Clean up
    consoleWarnMock.mockRestore();
  });

  it("should delete corrupted file on get and allow fresh start", () => {
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json }");
    expect(fs.existsSync(globalContextFilePath)).toBe(true);

    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Try to get a value - this should delete the corrupted file
    const value = globalContext.get("indexingPaused");
    expect(value).toBeUndefined();

    // File should be deleted after corruption is detected
    expect(fs.existsSync(globalContextFilePath)).toBe(false);

    // Now we should be able to update and get values normally
    globalContext.update("indexingPaused", true);
    const newValue = globalContext.get("indexingPaused");
    expect(newValue).toBe(true);

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

    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error updating global context, deleting corrupted file",
      ),
    );

    // The update should have recreated the file with just the new value
    const value = globalContext.get("indexingPaused");
    expect(value).toBe(true);

    // Clean up
    consoleWarnMock.mockRestore();
  });

  it("should delete and recreate corrupted file on update", () => {
    // Write invalid JSON to the file
    fs.writeFileSync(globalContextFilePath, "{ invalid json }");
    expect(fs.existsSync(globalContextFilePath)).toBe(true);

    const consoleWarnMock = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Try to update - this should delete the corrupted file and recreate it
    globalContext.update("indexingPaused", true);

    // File should still exist but with valid JSON now
    expect(fs.existsSync(globalContextFilePath)).toBe(true);

    // Should be able to read the value
    const value = globalContext.get("indexingPaused");
    expect(value).toBe(true);

    // Should be able to add more values
    globalContext.update("hasAlreadyCreatedAPromptFile", false);
    expect(globalContext.get("hasAlreadyCreatedAPromptFile")).toBe(false);
    // Original value should still be there
    expect(globalContext.get("indexingPaused")).toBe(true);

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
