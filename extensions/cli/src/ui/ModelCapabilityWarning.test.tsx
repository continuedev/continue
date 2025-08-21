import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, test } from "vitest";

import { ModelCapabilityWarning } from "./ModelCapabilityWarning.js";

describe("ModelCapabilityWarning", () => {
  test("should render warning message with model name", () => {
    const { lastFrame } = render(
      React.createElement(ModelCapabilityWarning, {
        modelName: "gpt-3-davinci",
      }),
    );

    const frame = lastFrame();
    if (frame) {
      expect(frame).toContain("Model Capability Warning");
      expect(frame).toContain("gpt-3-davinci");
      expect(frame).toContain(
        "is not recommended for use with cn due to limited reasoning and tool",
      );
      expect(frame).toContain("calling capabilities");
    }
  });

  test("should handle model names with slashes", () => {
    const { lastFrame } = render(
      React.createElement(ModelCapabilityWarning, {
        modelName: "local/mistral-7b",
      }),
    );

    const frame = lastFrame();
    if (frame) {
      expect(frame).toContain("local/mistral-7b");
    }
  });

  test("should display warning icon", () => {
    const { lastFrame } = render(
      React.createElement(ModelCapabilityWarning, { modelName: "test-model" }),
    );

    const frame = lastFrame();
    if (frame) {
      expect(frame).toContain("⚠️");
    }
  });
});
