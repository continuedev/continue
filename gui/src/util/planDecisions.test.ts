import { describe, expect, it } from "vitest";
import { recordPlanAnswer } from "./planDecisions";

const URI = "file:///ws/.continuous/plans/add-retry.md";

/** An in-memory plan file behind the two IDE methods the helper uses. */
function fakeIde(initial: string) {
  const files: Record<string, string> = { [URI]: initial };
  return {
    files,
    readFile: async (uri: string) => files[uri],
    writeFile: async (uri: string, contents: string) => {
      files[uri] = contents;
    },
  };
}

const FILE =
  "# Add retry\n\nWrap **upload()** in a retry.\n\n## Decisions\n\n" +
  "- Which format?\n  - type: scope\n  - options: ISO 8601 | Long\n  - pick: ISO 8601\n  - to-dos: 1\n" +
  "- Keep the old endpoint?\n  - pick: yes\n\n" +
  "## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it <!-- id: 2 -->\n";

describe("recordPlanAnswer", () => {
  it("adds the answer line to the decision and keeps the rest of the file", async () => {
    const ide = fakeIde(FILE);
    const decisions = await recordPlanAnswer(ide, URI, "Which format?", "Long");
    expect(decisions.map((d) => d.answer)).toEqual(["Long", undefined]);
    expect(ide.files[URI]).toBe(
      "# Add retry\n\nWrap **upload()** in a retry.\n\n## Decisions\n\n" +
        "- Which format?\n  - type: scope\n  - options: ISO 8601 | Long\n  - pick: ISO 8601\n  - to-dos: 1\n  - answer: Long\n" +
        "- Keep the old endpoint?\n  - pick: yes\n\n" +
        "## To-dos\n\n- [ ] Add a helper <!-- id: 1 -->\n- [ ] Use it <!-- id: 2 -->\n",
    );
  });

  it("reads the file as the person left it: their edits and answers stay", async () => {
    const edited = FILE.replace(
      "  - pick: yes\n",
      "  - pick: yes\n  - answer: no\n",
    ).replace(
      "- [ ] Use it <!-- id: 2 -->\n",
      "- [x] Use it <!-- id: 2 -->\n- [ ] Add tests\n",
    );
    const ide = fakeIde(edited);
    const decisions = await recordPlanAnswer(
      ide,
      URI,
      "Which format?",
      " ISO 8601 ",
    );
    expect(decisions.map((d) => d.answer)).toEqual(["ISO 8601", "no"]);
    const file = ide.files[URI];
    expect(file).toContain("  - answer: ISO 8601\n");
    expect(file).toContain("  - answer: no\n");
    expect(file).toContain("- [x] Use it <!-- id: 2 -->\n");
    expect(file).toContain("- [ ] Add tests <!-- id: 3 -->\n");
  });

  it("leaves the file alone for a question it does not have or an empty answer", async () => {
    const ide = fakeIde(FILE);
    await recordPlanAnswer(ide, URI, "Something else?", "yes");
    expect(ide.files[URI]).toBe(FILE);
    await recordPlanAnswer(ide, URI, "Which format?", "   ");
    expect(ide.files[URI]).toBe(FILE);
  });
});
