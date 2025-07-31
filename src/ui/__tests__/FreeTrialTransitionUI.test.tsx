import { render } from "ink-testing-library";
import React from "react";
import { jest } from "@jest/globals";
import FreeTrialTransitionUI from "../FreeTrialTransitionUI.js";

describe("FreeTrialTransitionUI - Rendering and Props Tests", () => {
  const mockOnComplete = jest.fn();
  const mockOnSwitchToLocalConfig = jest.fn();
  const mockOnFullReload = jest.fn();
  const mockOnShowConfigSelector = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial Choice Screen Rendering", () => {
    it("displays all three options with proper formatting", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain("🚀 Free trial limit reached!");
      expect(frame).toContain("1. 💳 Sign up for models add-on");
      expect(frame).toContain("2. 🔑 Enter your Anthropic API key");
      expect(frame).toContain("3. ⚙️ Switch to a different configuration");
      expect(frame).toContain("Use ↑↓ arrows or 1/2/3 to select");
    });

    it("highlights first option by default", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain("▶ 1. 💳 Sign up for models add-on");
      expect(frame).not.toContain("▶ 2. 🔑 Enter your Anthropic API key");
      expect(frame).not.toContain("▶ 3. ⚙️ Switch to a different configuration");
    });

    it("renders without crashing when all props are provided", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame?.length).toBeGreaterThan(0);
    });

    it("renders without crashing when onShowConfigSelector is not provided", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          // onShowConfigSelector not provided
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame?.length).toBeGreaterThan(0);
      expect(frame).toContain("3. ⚙️ Switch to a different configuration");
    });

    it("includes proper user instructions", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain("Choose how you'd like to continue:");
      expect(frame).toContain("Use ↑↓ arrows or 1/2/3 to select, Enter to confirm");
    });

    it("shows all options with proper descriptions", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain("Sign up for models add-on (recommended)");
      expect(frame).toContain("Enter your Anthropic API key");
      expect(frame).toContain("Switch to a different configuration");
    });
  });

  describe("Component Props and Interface", () => {
    it("accepts all required callback props", () => {
      // Test that component accepts and renders with all props
      expect(() => {
        render(
          <FreeTrialTransitionUI
            onComplete={mockOnComplete}
            onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
            onFullReload={mockOnFullReload}
            onShowConfigSelector={mockOnShowConfigSelector}
          />
        );
      }).not.toThrow();
    });

    it("accepts optional onShowConfigSelector prop", () => {
      // Test that component works without onShowConfigSelector
      expect(() => {
        render(
          <FreeTrialTransitionUI
            onComplete={mockOnComplete}
            onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
            onFullReload={mockOnFullReload}
          />
        );
      }).not.toThrow();
    });
  });

  describe("Visual Styling and Layout", () => {
    it("renders with proper border styling", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      // Check for box border characters (unicode box drawing)
      expect(frame).toMatch(/[╭╮╯╰│─]/);
    });

    it("displays with proper spacing and formatting", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      // Should have proper spacing between lines
      expect(frame?.split('\n').length).toBeGreaterThan(5);
    });

    it("shows selection indicator on first option by default", () => {
      const { lastFrame } = render(
        <FreeTrialTransitionUI
          onComplete={mockOnComplete}
          onSwitchToLocalConfig={mockOnSwitchToLocalConfig}
          onFullReload={mockOnFullReload}
          onShowConfigSelector={mockOnShowConfigSelector}
        />
      );

      const frame = lastFrame();
      const lines = frame?.split('\n') || [];
      const modelsLine = lines.find(line => line.includes('Sign up for models add-on'));
      const apiKeyLine = lines.find(line => line.includes('Enter your Anthropic API key'));
      const configLine = lines.find(line => line.includes('Switch to a different configuration'));

      expect(modelsLine).toContain('▶');
      expect(apiKeyLine).not.toContain('▶');
      expect(configLine).not.toContain('▶');
    });
  });
});