import { writeChecklistTool } from "./writeChecklist.js";

describe("writeChecklistTool", () => {
  it("should return formatted task list status", async () => {
    const checklist = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3`;

    const result = await writeChecklistTool.run({ checklist });

    expect(result).toBe(`Task list status:\n${checklist}`);
  });

  it("should have correct tool properties", () => {
    expect(writeChecklistTool.type).toBe("function");
    expect(writeChecklistTool.function.name).toBe("Checklist");
    expect(writeChecklistTool.displayName).toBe("Checklist");
    expect(writeChecklistTool.readonly).toBe(false);
    expect(writeChecklistTool.isBuiltIn).toBe(true);
    expect(
      writeChecklistTool.function.parameters.required?.includes("checklist"),
    ).toBe(true);
  });
});
