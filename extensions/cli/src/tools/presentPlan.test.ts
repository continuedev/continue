import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

import type { TaskPlan } from "core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  plan: undefined as TaskPlan | undefined,
  planFile: undefined as string | undefined,
  headless: false,
  answer: "Build",
  mode: "plan",
  stderr: [] as string[],
  edit: undefined as ((file: string) => void) | undefined,
}));

vi.mock("../session.js", () => ({
  getSessionTaskPlan: () => store.plan,
  updateSessionTaskPlan: (plan: TaskPlan | undefined) => {
    store.plan = plan;
  },
  getSessionPlanFile: () => store.planFile,
  updateSessionPlanFile: (file: string | undefined) => {
    store.planFile = file;
  },
  // No loop in these sessions
  getSessionLoop: () => undefined,
}));
vi.mock("../services/index.js", () => ({
  services: {
    toolPermissions: {
      isHeadless: () => store.headless,
      switchMode: (mode: string) => {
        store.mode = mode;
      },
    },
  },
}));
vi.mock("../services/QuizService.js", () => ({
  quizService: {
    askQuestion: vi.fn(async () => {
      // The person may edit the file while the question is open.
      if (store.edit && store.planFile) {
        const { fileURLToPath } = await import("url");
        store.edit(fileURLToPath(store.planFile));
      }
      return store.answer;
    }),
  },
}));
vi.mock("../init.js", () => ({
  safeStderr: (message: string) => store.stderr.push(message),
}));

import { quizService } from "../services/QuizService.js";

import { presentPlanTool } from "./presentPlan.js";

const args = {
  title: "Add retry",
  plan: "Wrap upload() in a retry.",
  todos: ["Add a helper", "Use it", "Test it"],
};

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cn-plan-"));
  file = path.join(dir, ".continuous", "plans", "add-retry.md");
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  Object.assign(store, {
    plan: undefined,
    planFile: undefined,
    headless: false,
    answer: "Build",
    mode: "plan",
    stderr: [],
    edit: undefined,
  });
  vi.mocked(quizService.askQuestion).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("PresentPlan", () => {
  it("writes the plan file and seeds the task list", async () => {
    store.answer = "Keep planning";
    await presentPlanTool.run(args);

    const text = fs.readFileSync(file, "utf-8");
    expect(text).toContain("# Add retry");
    expect(text).toContain("Wrap upload() in a retry.");
    expect(text).toContain("- [ ] Add a helper <!-- id: 1 -->");
    expect(store.plan?.items.map((i) => [i.id, i.text, i.status])).toEqual([
      ["1", "Add a helper", "pending"],
      ["2", "Use it", "pending"],
      ["3", "Test it", "pending"],
    ]);
    expect(store.planFile).toBe(pathToFileURL(file).href);
  });

  it("Build reads the file back, leaves plan mode and says to implement", async () => {
    store.edit = (f) =>
      fs.writeFileSync(
        f,
        "# Add retry\n\n## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it everywhere\n",
      );
    const result = await presentPlanTool.run(args);

    expect(quizService.askQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ["Build", "Build in a loop", "Keep planning"],
      }),
    );
    expect(store.mode).toBe("normal");
    expect(result).toContain("approved the plan");
    expect(result).toContain(
      "Build the plan in .continuous/plans/add-retry.md",
    );
    expect(store.plan?.updatedBy).toBe("user");
    expect(store.plan?.items.map((i) => i.text)).toEqual([
      "Add a helper",
      "Use it everywhere",
    ]);
    expect(result).toContain("Use it everywhere");
  });

  it("asks the decisions first, writes the answers to the file and tells the model", async () => {
    vi.mocked(quizService.askQuestion)
      .mockImplementationOnce(async () => "November 8, 2026")
      .mockImplementationOnce(async () => "Build");
    const result = await presentPlanTool.run({
      ...args,
      decisions: [
        {
          question: "Which format should formatDate return?",
          options: ["ISO 8601", "November 8, 2026"],
          pick: "ISO 8601",
          type: "scope",
          todos: [1],
        },
      ],
    });

    expect(quizService.askQuestion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        question: "Decision 1 of 1: Which format should formatDate return?",
        options: ["ISO 8601", "November 8, 2026"],
        defaultAnswer: "ISO 8601",
      }),
    );
    const text = fs.readFileSync(file, "utf-8");
    expect(text).toContain("## Decisions");
    expect(text).toContain("  - answer: November 8, 2026");
    expect(result).toContain(
      "1. Which format should formatDate return? (to-dos 1): decided: November 8, 2026",
    );
    expect(store.mode).toBe("normal");
  });

  it("headless: the decisions wait in the file and the model is told not to settle them", async () => {
    store.headless = true;
    const result = await presentPlanTool.run({
      ...args,
      decisions: [{ question: "Which format?" }],
    });
    expect(quizService.askQuestion).not.toHaveBeenCalled();
    expect(result).toContain("Its decision waits for the person in the file");
    expect(fs.readFileSync(file, "utf-8")).toContain("- Which format?");
  });

  it("Keep planning stays in plan mode, with or without feedback", async () => {
    store.answer = "Keep planning";
    const plain = await presentPlanTool.run(args);
    expect(store.mode).toBe("plan");
    expect(plain).toMatch(/keep planning/);

    store.answer = "Split step 2";
    const feedback = await presentPlanTool.run(args);
    expect(store.mode).toBe("plan");
    expect(feedback).toContain("Split step 2");
  });

  it("presenting again replaces this session's file, not another one", async () => {
    store.answer = "Keep planning";
    await presentPlanTool.run(args);
    await presentPlanTool.run({ ...args, todos: ["Only step"] });
    expect(fs.readdirSync(path.dirname(file))).toEqual(["add-retry.md"]);
    expect(fs.readFileSync(file, "utf-8")).toContain("Only step");

    store.planFile = undefined; // a new session
    await presentPlanTool.run(args);
    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual([
      "add-retry-2.md",
      "add-retry.md",
    ]);
  });

  it("headless: saves, prints the path and does not ask", async () => {
    store.headless = true;
    const result = await presentPlanTool.run(args);
    expect(quizService.askQuestion).not.toHaveBeenCalled();
    expect(store.mode).toBe("plan");
    expect(fs.existsSync(file)).toBe(true);
    expect(store.stderr.join("")).toContain(
      "Plan saved to .continuous/plans/add-retry.md",
    );
    expect(result).toContain("Plan: .continuous/plans/add-retry.md");
  });

  it("refuses bad arguments in preprocess, before anything is written", async () => {
    await expect(
      presentPlanTool.preprocess!({ title: "T", todos: [] }),
    ).rejects.toThrow(/todos/);
    const ok = await presentPlanTool.preprocess!(args);
    expect(ok.preview?.map((p) => p.type)).toEqual([
      "text",
      "text",
      "checklist",
    ]);
    expect(fs.existsSync(path.join(dir, ".continuous"))).toBe(false);
  });
});
