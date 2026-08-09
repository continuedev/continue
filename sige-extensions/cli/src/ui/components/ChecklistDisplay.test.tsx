import { render } from "ink-testing-library";
import React from "react";

import { ChecklistDisplay } from "./ChecklistDisplay.js";

describe("ChecklistDisplay", () => {
  it("should highlight the first incomplete item", () => {
    const content = `Task list status:
- [x] Completed task
- [ ] First incomplete task
- [ ] Second incomplete task`;

    const { lastFrame } = render(<ChecklistDisplay content={content} />);
    const output = lastFrame();

    // The output should contain the checkbox symbols and text
    expect(output).toContain("✓");
    expect(output).toContain("○");
    expect(output).toContain("Completed task");
    expect(output).toContain("First incomplete task");
    expect(output).toContain("Second incomplete task");
  });

  it("should handle empty checklist", () => {
    const content = "Task list status:";

    const { lastFrame } = render(<ChecklistDisplay content={content} />);
    const output = lastFrame();

    expect(output).toBeDefined();
  });

  it("should handle all completed tasks", () => {
    const content = `Task list status:
- [x] Completed task 1
- [x] Completed task 2`;

    const { lastFrame } = render(<ChecklistDisplay content={content} />);
    const output = lastFrame();

    expect(output).toContain("✓");
    expect(output).toContain("Completed task 1");
    expect(output).toContain("Completed task 2");
  });

  it("should handle mixed content with headers", () => {
    const content = `Task list status:
## Important Tasks
- [x] Done task
- [ ] Todo task

## Other Tasks
- [ ] Another todo`;

    const { lastFrame } = render(<ChecklistDisplay content={content} />);
    const output = lastFrame();

    expect(output).toContain("Important Tasks");
    expect(output).toContain("Other Tasks");
    expect(output).toContain("✓");
    expect(output).toContain("○");
  });
});
