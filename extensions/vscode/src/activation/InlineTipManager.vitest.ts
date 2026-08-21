import { describe, expect, it, vi } from "vitest";

// createSvgTooltipDecoration only calls window.createTextEditorDecorationType,
// but importing the module pulls in helpers that read the workspace config, so
// the mock covers that surface too.
vi.mock("vscode", () => ({
  window: {
    createTextEditorDecorationType: vi
      .fn()
      .mockReturnValue({ dispose: vi.fn() }),
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({ get: vi.fn() }),
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  Uri: { file: vi.fn(), parse: vi.fn() },
}));
vi.mock("core/control-plane/env", () => ({ EXTENSION_NAME: "continue" }));
vi.mock("../util/util", () => ({
  getMetaKeyLabel: () => "Cmd",
  getMetaKeyName: () => "metaKey",
}));
vi.mock("../util/getTheme", () => ({
  getTheme: vi.fn().mockReturnValue({ colors: {} }),
}));
vi.mock("svg-builder", () => ({
  default: { newInstance: () => ({ width: () => ({ height: () => ({}) }) }) },
}));

import { InlineTipManager } from "./InlineTipManager";

describe("InlineTipManager.createSvgTooltipDecoration", () => {
  it("does not throw when the active theme exposes no colors map", () => {
    // A non-standard color theme can produce a Monaco theme whose `colors` is
    // undefined. Previously the guard only checked `this.theme` was truthy and
    // then read `this.theme.colors["editor.background"]`, throwing a TypeError
    // that killed extension activation (issue #12947).
    const instance = Object.create(InlineTipManager.prototype) as {
      createSvgTooltipDecoration: () => unknown;
      theme: unknown;
    };
    instance.theme = { colors: undefined };

    expect(() => instance.createSvgTooltipDecoration()).not.toThrow();
  });

  it("uses the theme background when the colors map is present", () => {
    const instance = Object.create(InlineTipManager.prototype) as {
      createSvgTooltipDecoration: () => unknown;
      theme: unknown;
    };
    instance.theme = { colors: { "editor.background": "#101010" } };

    expect(() => instance.createSvgTooltipDecoration()).not.toThrow();
  });
});
