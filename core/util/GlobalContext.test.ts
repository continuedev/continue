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
        "Error updating global context, attempting to salvage security-sensitive values",
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

  describe("salvage functionality", () => {
    it("should salvage allowAnonymousTelemetry from corrupted sharedConfig", () => {
      // Create a file with partially corrupted JSON that contains salvageable sharedConfig
      const corruptedContent = `{
  "indexingPaused": true,
  "sharedConfig": {"allowAnonymousTelemetry": false},
  "corrupted": { invalid json
}`;
      fs.writeFileSync(globalContextFilePath, corruptedContent);

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Try to update - this should salvage the allowAnonymousTelemetry value
      globalContext.update("indexingPaused", false);

      expect(consoleWarnMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "Error updating global context, attempting to salvage security-sensitive values",
        ),
      );

      // Should have the new value
      expect(globalContext.get("indexingPaused")).toBe(false);

      // Should have salvaged the sharedConfig with allowAnonymousTelemetry
      const salvaged = globalContext.get("sharedConfig");
      expect(salvaged).toEqual({ allowAnonymousTelemetry: false });

      consoleWarnMock.mockRestore();
    });

    it("should handle salvage when no sharedConfig is present", () => {
      const corruptedContent = `{
  "indexingPaused": true,
  "corrupted": { invalid json
}`;
      fs.writeFileSync(globalContextFilePath, corruptedContent);

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      globalContext.update("hasAlreadyCreatedAPromptFile", true);

      expect(consoleWarnMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "Error updating global context, attempting to salvage security-sensitive values",
        ),
      );

      // Should have the new value
      expect(globalContext.get("hasAlreadyCreatedAPromptFile")).toBe(true);

      // Should not have any sharedConfig since none was salvageable
      expect(globalContext.get("sharedConfig")).toBeUndefined();

      consoleWarnMock.mockRestore();
    });

    it("should handle salvage when sharedConfig has invalid allowAnonymousTelemetry", () => {
      const corruptedContent = `{
  "indexingPaused": true,
  "sharedConfig": {"allowAnonymousTelemetry": "not-a-boolean"},
  "corrupted": { invalid json
}`;
      fs.writeFileSync(globalContextFilePath, corruptedContent);

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      globalContext.update("indexingPaused", false);

      // Should not have salvaged an invalid boolean value
      const salvaged = globalContext.get("sharedConfig");
      expect(salvaged).toBeUndefined();

      consoleWarnMock.mockRestore();
    });

    it("should handle salvage with valid allowAnonymousTelemetry set to true", () => {
      const corruptedContent = `{
  "indexingPaused": true,
  "sharedConfig": {"allowAnonymousTelemetry": true, "otherField": "value"},
  "corrupted": { invalid json
}`;
      fs.writeFileSync(globalContextFilePath, corruptedContent);

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      globalContext.update("hasAlreadyCreatedAPromptFile", true);

      // Should have salvaged only the allowAnonymousTelemetry value
      const salvaged = globalContext.get("sharedConfig");
      expect(salvaged).toEqual({ allowAnonymousTelemetry: true });

      consoleWarnMock.mockRestore();
    });

    it("should handle completely unparseable content gracefully", () => {
      fs.writeFileSync(
        globalContextFilePath,
        "complete garbage not json at all",
      );

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      globalContext.update("indexingPaused", true);

      // Should still work and create a new file
      expect(globalContext.get("indexingPaused")).toBe(true);
      expect(globalContext.get("sharedConfig")).toBeUndefined();

      consoleWarnMock.mockRestore();
    });

    it("should preserve multiple salvageable values when updating different key", () => {
      const corruptedContent = `{
  "indexingPaused": true,
  "sharedConfig": {"allowAnonymousTelemetry": false},
  "hasAlreadyCreatedAPromptFile": true,
  "corrupted": { invalid json
}`;
      fs.writeFileSync(globalContextFilePath, corruptedContent);

      const consoleWarnMock = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Update a different key - should salvage and preserve existing data
      globalContext.update("showConfigUpdateToast", false);

      // Should have the new value
      expect(globalContext.get("showConfigUpdateToast")).toBe(false);

      // Should have salvaged the security-sensitive value
      expect(globalContext.get("sharedConfig")).toEqual({
        allowAnonymousTelemetry: false,
      });

      consoleWarnMock.mockRestore();
    });
  });
});
