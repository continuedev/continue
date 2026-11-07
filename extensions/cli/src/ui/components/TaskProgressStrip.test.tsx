import type { TaskPlan } from "core/index.js";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const listeners = vi.hoisted(() => new Set<(p?: TaskPlan) => void>());
vi.mock("../../session.js", () => ({
  getSessionTaskPlan: () => undefined,
  onTaskPlanChange: (fn: (p?: TaskPlan) => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
}));

import { TaskProgressStrip } from "./TaskProgressStrip.js";

const plan: TaskPlan = {
  items: [
    { id: "1", text: "Write", status: "completed" },
    {
      id: "2",
      text: "Run migrations",
      status: "in_progress",
      activeForm: "Running migrations",
    },
    { id: "3", text: "Deploy", status: "pending" },
  ],
  updatedAt: "2026-11-06T12:00:00.000Z",
};

describe("TaskProgressStrip", () => {
  it("shows nothing without a list", () => {
    expect(render(<TaskProgressStrip />).lastFrame()).toBe("");
  });

  it("shows done/total and the in-progress label", () => {
    expect(render(<TaskProgressStrip plan={plan} />).lastFrame()).toContain(
      "Tasks 1/3 Running migrations",
    );
  });

  it("follows changes to the session's list", async () => {
    const view = render(<TaskProgressStrip />);
    const tick = () => new Promise((r) => setTimeout(r, 20));
    for (let i = 0; i < 10 && listeners.size === 0; i++) await tick();
    expect(listeners.size).toBeGreaterThan(0);
    for (const listener of listeners) listener(plan);
    for (let i = 0; i < 10 && !view.lastFrame()?.includes("1/3"); i++) {
      await tick();
    }
    expect(view.lastFrame()).toContain("1/3 Running migrations");
  });
});
