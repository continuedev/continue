# Skills bundled with Ruckus IDE

This directory is the source library shipped with the **VS Code extension**.
It currently contains 54 skills: 3 local workflows, 37 Matt Pocock skills,
5 Superpowers skills, and 9 Vercel skills.

## Use a skill

Build/install the updated extension, reload the editor window, and use Agent mode.
For example:

- `Use $vercel-react-best-practices to review this React component.`
- `Use $diagnosing-bugs to investigate this error.`
- `Use $code-review to review my current diff.`

The agent sees a catalog and calls `read_skill` to load the selected instructions.
Reference files are loaded only when needed. Skills marked
`disable-model-invocation: true` are advertised as manual-only: ask for them by name.
These are model instructions, not new executable tools or permission grants.
Browser automation, external CLIs, credentials, and other dependencies mentioned in
skills must exist in the IDE session before they can be used. `ruckus-browser` has
been adapted to this IDE's terminal and optional browser MCP tools.

## Add or update skills

1. Add a complete skill directory here, or under `vendor/<source>/`. Include its
   `SKILL.md`, referenced files, scripts, and license information.
2. Give it a unique lowercase `name` and a nonempty `description` in YAML frontmatter.
3. Run `npm --prefix extensions/vscode run esbuild` from the repository root to
   validate the skills and rebuild the extension. To regenerate only the skill
   payload, run `node scripts/build-bundled-skills.js`.
4. Rebuild/repackage the extension and reload its window. Source Markdown changes
   alone do not trigger esbuild's code watcher.

The generated `extensions/vscode/bundled-skills/` directory is ignored by Git but
included in the VSIX. Keep this source directory in version control. Do not edit
the generated copy. The builder preserves the source tree and normalizes the four
Vercel directory names whose metadata has a `vercel-` prefix. `manifest.json` records
source/output mappings and SKILL.md hashes; existing source locks and licenses are
copied unchanged.

Project skills take precedence over personal skills, which take precedence over
bundled skills. Override a bundled skill by installing the same `name` in your
project's `.agents/skills/<name>/SKILL.md` or your personal skills directory.
No files are installed into user projects or home directories by the build.
