const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const repoRoot = path.resolve(__dirname, "..");
const { parse } = require(
  require.resolve("yaml", { paths: [path.join(repoRoot, "core")] }),
);

/** Package source skills without editing vendor files or copying them into user projects. */
function buildBundledSkills({
  source = path.join(repoRoot, "skillstoadd"),
  destination = path.join(repoRoot, "extensions/vscode/bundled-skills"),
} = {}) {
  const skills = [];
  const names = new Set();
  const excluded = new Set([
    ".git",
    "node_modules",
    "__pycache__",
    ".DS_Store",
  ]);
  function walk(dir) {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (excluded.has(entry.name)) continue;
      const filename = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `Bundled skills must contain real files, not symlinks: ${filename}`,
        );
      if (entry.isDirectory()) walk(filename);
      else if (entry.name === "SKILL.md") {
        const content = fs
          .readFileSync(filename, "utf8")
          .replace(/^\uFEFF/, "")
          .replace(/\r\n/g, "\n");
        const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(content);
        const metadata = match && parse(match[1]);
        if (
          !metadata ||
          typeof metadata.name !== "string" ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name) ||
          metadata.name.length > 64 ||
          typeof metadata.description !== "string" ||
          !metadata.description.trim() ||
          metadata.description.length > 1024
        ) {
          throw new Error(`Invalid skill metadata: ${filename}`);
        }
        if (names.has(metadata.name))
          throw new Error(`Duplicate bundled skill: ${metadata.name}`);
        names.add(metadata.name);
        const sourcePath = path.relative(source, dir);
        const packagedPath = path.join(path.dirname(sourcePath), metadata.name);
        skills.push({
          name: metadata.name,
          source: sourcePath.split(path.sep).join("/"),
          path: packagedPath.split(path.sep).join("/"),
          sha256: createHash("sha256")
            .update(fs.readFileSync(filename))
            .digest("hex"),
        });
      }
    }
  }
  walk(source);
  if (!skills.length)
    throw new Error("No SKILL.md files found in skillstoadd.");

  // Validate first, then replace only the generated build directory.
  const stage = `${destination}.tmp`;
  fs.rmSync(stage, { recursive: true, force: true });
  fs.cpSync(source, stage, {
    recursive: true,
    filter: (file) =>
      !excluded.has(path.basename(file)) &&
      !path.basename(file).startsWith(".env"),
  });
  for (const skill of skills) {
    if (skill.source === skill.path) continue;
    const target = path.join(stage, skill.path);
    if (fs.existsSync(target))
      throw new Error(`Skill package path collision: ${skill.path}`);
    fs.renameSync(path.join(stage, skill.source), target);
  }
  fs.writeFileSync(
    path.join(stage, "manifest.json"),
    JSON.stringify({ version: 1, skills }, null, 2) + "\n",
  );
  fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(stage, destination);
  console.log(`Bundled ${skills.length} skills in ${destination}`);
  return skills;
}

if (require.main === module) buildBundledSkills();
module.exports = { buildBundledSkills };
