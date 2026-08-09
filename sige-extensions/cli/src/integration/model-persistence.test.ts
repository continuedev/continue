import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getModelName, updateModelName } from "../auth/workos.js";
import {
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

describe("Model Persistence Integration", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;

  beforeEach(() => {
    // Create a temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
    originalContinueHome = process.env.CONTINUE_GLOBAL_DIR;
    process.env.CONTINUE_GLOBAL_DIR = testDir;

    // Clear GlobalContext for clean test state
    persistModelName(null);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    if (originalContinueHome) {
      process.env.CONTINUE_GLOBAL_DIR = originalContinueHome;
    } else {
      delete process.env.CONTINUE_GLOBAL_DIR;
    }
  });

  test("should persist model name when user selects a model", () => {
    // User selects a model (auth is always null now)
    updateModelName("Claude 3.5 Sonnet");

    // Verify model name is persisted via GlobalContext
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");
  });

  test("should update model name when user switches models", () => {
    // Set initial model
    updateModelName("GPT-4");
    expect(getModelName(null)).toBe("GPT-4");

    // User switches to a different model
    updateModelName("Claude 3.5 Sonnet");

    // Verify new model name
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");
  });

  test("should clear model name when set to null", () => {
    // Set a model
    updateModelName("GPT-4");
    expect(getModelName(null)).toBe("GPT-4");

    // Clear model name
    updateModelName(null);

    // Verify model name is cleared
    expect(getModelName(null)).toBeNull();
  });

  test("should return null for model name when no model persisted", () => {
    // No model persisted and no auth config
    persistModelName(null); // Ensure GlobalContext is clear
    expect(getModelName(null)).toBeNull();
  });

  test("should persist model name via GlobalContext", () => {
    updateModelName("Claude 3.5 Sonnet");

    // Verify via getPersistedModelName
    expect(getPersistedModelName()).toBe("Claude 3.5 Sonnet");

    // Verify via getModelName (which reads from GlobalContext)
    expect(getModelName(null)).toBe("Claude 3.5 Sonnet");
  });
});
