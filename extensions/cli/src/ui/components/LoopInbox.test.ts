import { createLoop, finishItemRun, startItemRun } from "core/util/loopMode.js";
import { describe, expect, it } from "vitest";

import { LOOP_CHECKLIST_LINES, loopChecklist } from "./LoopInbox.js";

const NOW = new Date("2026-11-07T10:00:00Z");

function planOf(count: number) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      text: `Item ${i + 1}`,
      status: "pending" as const,
    })),
    updatedAt: NOW.toISOString(),
  };
}

/** A loop with the first `done` items finished and the next one running. */
function loopAt(count: number, done: number) {
  const plan = planOf(count);
  let loop = createLoop(plan, { now: NOW, sessionTokens: 0 });
  for (let i = 1; i <= done; i++) {
    loop = finishItemRun(startItemRun(loop, String(i), 0, NOW), {
      outcome: "done",
      summary: `Did ${i}`,
    });
  }
  loop = startItemRun(loop, String(done + 1), 0, NOW);
  return { loop, plan };
}

describe("the loop's checklist", () => {
  it("in full, lists every item with what its run reported", () => {
    const { loop, plan } = loopAt(3, 1);
    expect(loopChecklist(loop, plan)).toBe(
      ["- [x] Item 1 (Did 1)", "- [>] Item 2", "- [ ] Item 3"].join("\n"),
    );
  });

  it("compact, folds finished items but the last and caps the open ones", () => {
    const { loop, plan } = loopAt(20, 4);
    const lines = loopChecklist(loop, plan, { compact: true }).split("\n");
    expect(lines[0]).toBe("3 earlier items done");
    expect(lines[1]).toBe("- [x] Item 4");
    expect(lines[2]).toBe("- [>] Item 5");
    expect(lines).toHaveLength(LOOP_CHECKLIST_LINES + 1);
    // Items 4 to 20 are shown or counted: 7 fit under the header
    expect(lines.at(-1)).toBe("… 10 more");
  });

  it("compact, still says what an item waits on", () => {
    const plan = planOf(2);
    const loop = finishItemRun(
      startItemRun(
        createLoop(plan, { now: NOW, sessionTokens: 0 }),
        "1",
        0,
        NOW,
      ),
      { outcome: "waiting" },
    );
    expect(loopChecklist(loop, plan, { compact: true })).toBe(
      ["- [!] Item 1 (Waiting on you: an answer)", "- [ ] Item 2"].join("\n"),
    );
  });
});
