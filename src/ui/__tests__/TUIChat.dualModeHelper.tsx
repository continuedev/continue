import { render } from "ink-testing-library";
import React from "react";
import { createUITestContext } from "../../test-helpers/ui-test-context.js";
import TUIChat from "../TUIChat.js";

export type TestMode = 'local' | 'remote';

/**
 * Helper to run a test in both local and remote modes
 * This creates two test suites - one for each mode
 */
export function testBothModes(
  name: string, 
  testFn: (mode: TestMode) => void | Promise<void>
) {
  describe(`${name} [LOCAL MODE]`, () => {
    let context: any;

    beforeEach(() => {
      context = createUITestContext({
        allServicesReady: true,
        serviceState: "ready",
      });
    });

    afterEach(() => {
      context.cleanup();
    });

    it("works in local mode", async () => {
      await testFn('local');
    });
  });

  describe(`${name} [REMOTE MODE]`, () => {
    let context: any;

    beforeEach(() => {
      context = createUITestContext({
        allServicesReady: true,
        serviceState: "ready",
      });
    });

    afterEach(() => {
      context.cleanup();
    });

    it("works in remote mode", async () => {
      await testFn('remote');
    });
  });
}

/**
 * Helper to render TUIChat in the specified mode
 */
export function renderInMode(mode: TestMode, props?: any) {
  return render(
    mode === 'remote' 
      ? React.createElement(TUIChat, { remoteUrl: "http://localhost:3000", ...props })
      : React.createElement(TUIChat, props)
  ) as ReturnType<typeof render>; // Explicit type to avoid TypeScript issues
}

/**
 * Helper to run a test in only one mode
 */
export function testSingleMode(
  name: string,
  mode: TestMode,
  testFn: () => void | Promise<void>
) {
  describe(`${name} [${mode.toUpperCase()} MODE ONLY]`, () => {
    let context: any;

    beforeEach(() => {
      context = createUITestContext({
        allServicesReady: true,
        serviceState: "ready",
      });
    });

    afterEach(() => {
      context.cleanup();
    });

    it(`works in ${mode} mode`, async () => {
      await testFn();
    });
  });
}