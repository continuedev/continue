import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ConfigSelector } from "../ConfigSelector.js";
import { Selector } from "../Selector.js";

describe("Ctrl+C behavior", () => {
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnSelect: ReturnType<typeof vi.fn>;
  let mockProcess: any;

  beforeEach(() => {
    mockOnCancel = vi.fn();
    mockOnSelect = vi.fn();

    // Mock process.exit for testing
    mockProcess = {
      exit: vi.fn(),
      kill: vi.fn(),
    };
    vi.stubGlobal("process", mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Selector component", () => {
    it("calls onCancel when Ctrl+C is pressed", () => {
      const options = [
        { id: "1", name: "Option 1" },
        { id: "2", name: "Option 2" },
      ];

      const { stdin } = render(
        <Selector
          title="Test"
          options={options}
          selectedIndex={0}
          loading={false}
          error={null}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          onNavigate={vi.fn()}
        />,
      );

      // Simulate Ctrl+C
      stdin.write("\u0003");

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("calls onCancel when Ctrl+C is pressed during loading", () => {
      const options: any[] = [];

      const { stdin } = render(
        <Selector
          title="Loading Test"
          options={options}
          selectedIndex={0}
          loading={true}
          error={null}
          loadingMessage="Loading..."
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          onNavigate={vi.fn()}
        />,
      );

      // Simulate Ctrl+C during loading
      stdin.write("\u0003");

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when Ctrl+C is pressed during error state", () => {
      const options: any[] = [];

      const { stdin } = render(
        <Selector
          title="Error Test"
          options={options}
          selectedIndex={0}
          loading={false}
          error="Something went wrong"
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          onNavigate={vi.fn()}
        />,
      );

      // Simulate Ctrl+C during error
      stdin.write("\u0003");

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("ConfigSelector component", () => {
    it("calls onCancel when Ctrl+C is pressed", () => {
      const { stdin } = render(
        <ConfigSelector onSelect={mockOnSelect} onCancel={mockOnCancel} />,
      );

      // Simulate Ctrl+C
      stdin.write("\u0003");

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
