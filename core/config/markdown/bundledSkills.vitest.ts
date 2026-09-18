import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { IDE } from "../..";
import { loadMarkdownSkills } from "./loadMarkdownSkills";
import { readSkillImpl } from "../../tools/implementations/readSkill";
import { readFileImpl } from "../../tools/implementations/readFile";
import { readSkillTool } from "../../tools/definitions/readSkill";

const root = path.resolve(__dirname, "../../..");
const bundledDir = path.join(root, "extensions/vscode/bundled-skills");
const bundledUri = pathToFileURL(bundledDir).href;
const ide = {
  getWorkspaceDirs: async () => ["file:///unrelated-project"],
  getBundledSkillsDir: async () => bundledUri,
  fileExists: async (uri: string) =>
    uri.startsWith(bundledUri) &&
    (await fs.stat(fileURLToPath(uri)).then(
      () => true,
      () => false,
    )),
  readFile: async (uri: string) =>
    await fs.readFile(fileURLToPath(uri), "utf8"),
  listDir: async (uri: string) =>
    (await fs.readdir(fileURLToPath(uri), { withFileTypes: true })).map(
      (entry) => [entry.name, entry.isDirectory() ? 2 : 1],
    ),
} as IDE;

beforeAll(() => {
  execFileSync(
    process.execPath,
    [path.join(root, "scripts/build-bundled-skills.js")],
    { cwd: root },
  );
});

describe("packaged skills", () => {
  it("discovers all 54 skills from the installed extension in an unrelated project", async () => {
    const { skills, errors } = await loadMarkdownSkills(ide, false);
    expect(errors).toEqual([]);
    expect(skills).toHaveLength(54);
    expect(new Set(skills.map((skill) => skill.name)).size).toBe(54);
    expect(skills.map((skill) => skill.name)).toContain(
      "vercel-react-best-practices",
    );
    expect(skills.every((skill) => skill.path.startsWith(bundledUri))).toBe(
      true,
    );
  });

  it("loads instructions and preserves readable supporting files", async () => {
    const [{ content }] = await readSkillImpl(
      { skillName: "vercel-react-best-practices" },
      { ide } as any,
    );
    expect(content).toContain("React");
    const uri = `${bundledUri}/vendor/vercel/vercel-react-best-practices/AGENTS.md`;
    expect(content).toContain(uri);
    const [reference] = await readFileImpl({ filepath: uri }, {
      ide,
      config: { selectedModelByRole: { chat: null } },
    } as any);
    expect(reference.content).toContain("React Best Practices");
    expect(
      await ide.readFile(`${bundledUri}/vendor/mattpocock/LICENSE`),
    ).toContain("MIT");
    expect(
      await ide.readFile(`${bundledUri}/vendor/superpowers/LICENSE`),
    ).toContain("MIT");
  });

  it("preserves manual activation hints in the catalog", async () => {
    const { skills } = await loadMarkdownSkills(ide, false);
    expect(skills.find((skill) => skill.name === "teach")).toMatchObject({
      "disable-model-invocation": true,
      "argument-hint": "What would you like to learn about?",
    });
    const tool = await readSkillTool({ ide } as any);
    expect(tool.function.description).toContain('"manualOnly":true');
    expect(tool.function.description).toContain(
      "only be loaded when the user explicitly asks",
    );
  });

  it("retains source provenance and normalizes four vendor directory names", async () => {
    const manifest = JSON.parse(
      await fs.readFile(path.join(bundledDir, "manifest.json"), "utf8"),
    );
    expect(manifest.skills).toHaveLength(54);
    expect(
      manifest.skills.filter((entry: any) => entry.source !== entry.path),
    ).toHaveLength(4);
    expect(
      await fs.readFile(path.join(bundledDir, "sources.lock.json"), "utf8"),
    ).toBe(
      await fs.readFile(
        path.join(root, "skillstoadd/sources.lock.json"),
        "utf8",
      ),
    );
  });
});
