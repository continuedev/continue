import { streamDiff } from "../diff/streamDiff.js";
import { DiffLine, DiffLineType } from "../index.js";
// @ts-ignore no typings available
import { changed, diff as myersDiff } from "myers-diff";
import { dedent } from "../util/index.js";

// "modification" is an extra type used to represent an "old" + "new" diff line
type MyersDiffTypes = Extract<DiffLineType, "new" | "old"> | "modification";

async function* generateLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

async function collectDiffs(
  oldLines: string[],
  newLines: string[],
): Promise<{ streamDiffs: DiffLine[]; myersDiffs: any }> {
  const streamDiffs: DiffLine[] = [];

  for await (const diffLine of streamDiff(oldLines, generateLines(newLines))) {
    streamDiffs.push(diffLine);
  }

  const myersDiffs = myersDiff(oldLines.join("\n"), newLines.join("\n"));
  // const myersDiffs: DiffLine[] = myersDiffsRaw.map((diff) => ({
  //   type: getMyersDiffType(diff),
  //   line: diff.rhs,
  // }));

  return { streamDiffs, myersDiffs };
}

function getMyersDiffType(diff: any): MyersDiffTypes | undefined {
  if (changed(diff.rhs) && !changed(diff.lhs)) {
    return "new";
  }

  if (!changed(diff.rhs) && changed(diff.lhs)) {
    return "old";
  }

  if (changed(diff.rhs) && changed(diff.lhs)) {
    return "modification";
  }

  return undefined;
}

function displayDiff(diff: DiffLine[]) {
  const symbol = {
    same: " ",
    new: "+",
    old: "-",
  };
  console.log(
    diff.map(({ type, line }) => `${symbol[type]} ${line}`).join("\n"),
  );
}

// We use a longer `)` string here to not get
// caught by the fuzzy matcher
describe("streamDiff(", () => {
  test("no changes", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "same", line: "second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs).toEqual([]);
  });

  test("add new line", async () => {
    const oldLines = ["first item", "second arg"];
    const newLines = ["first item", "second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "same", line: "second arg" },
      { type: "new", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("remove line", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test("modify line", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "modified second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "new", line: "modified second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("modification");
  });

  test("add multiple lines", async () => {
    const oldLines = ["first item", "fourth val"];
    const newLines = ["first item", "second arg", "third param", "fourth val"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "new", line: "second arg" },
      { type: "new", line: "third param" },
      { type: "same", line: "fourth val" },
    ]);

    // Multi-line addition
    expect(myersDiffs[0].rhs.add).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("remove multiple lines", async () => {
    const oldLines = ["first item", "second arg", "third param", "fourth val"];
    const newLines = ["first item", "fourth val"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "old", line: "third param" },
      { type: "same", line: "fourth val" },
    ]);

    // Multi-line deletion
    expect(myersDiffs[0].lhs.del).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test("empty old lines", async () => {
    const oldLines: string[] = [];
    const newLines = ["first item", "second arg"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "new", line: "first item" },
      { type: "new", line: "second arg" },
    ]);

    // Multi-line addition
    expect(myersDiffs[0].rhs.add).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("empty new lines", async () => {
    const oldLines = ["first item", "second arg"];
    const newLines: string[] = [];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "old", line: "first item" },
      { type: "old", line: "second arg" },
    ]);

    // Multi-line deletion
    expect(myersDiffs[0].lhs.del).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test.only("tabs vs. spaces differences are ignored", async () => {
    const oldLines = dedent`
\tfrom fastapi import FastAPI

\tapp = FastAPI()

\t@app.get("/")
\tdef read_root():
\t\treturn {"Hello": "World"}

\t@app.get("/landing")
\tdef read_landing_page():
\t\treturn {"message": "Welcome to the landing page"}
  `.split("\n");
    const newLines = dedent`
    from fastapi import FastAPI, HTTPException

    app = FastAPI()

    @app.get("/")
    def read_root():
        return {"Hello": "World"}

    @app.get("/landing")
    def read_landing_page():
        raise HTTPException(status_code=404, detail="Page not found")
  `.split("\n");

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);
    displayDiff(streamDiffs);
  });

  test("FastAPI example", async () => {
    const oldLines = dedent`
      from fastapi import FastAPI

      app = FastAPI()

      @app.get("/")
      def read_root():
          return {"Hello": "World"}

      @app.get("/landing")
      def read_landing_page():
          return {"message": "Welcome to the landing page"}
    `.split("\n");
    const newLines = dedent`
      from fastapi import FastAPI, HTTPException

      app = FastAPI()

      @app.get("/")
      def read_root():
          return {"Hello": "World"}

      @app.get("/landing")
      def read_landing_page():
          raise HTTPException(status_code=404, detail="Page not found")
    `.split("\n");

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);
    displayDiff(streamDiffs);
  });
});
