I’ll quickly check this repo’s documented VS Code extension workflow so I can give you the exact install and test steps for your current changes.

Search complete: Locate extension workflow

Searched codebase for "VS Code extension local install run extension host packaging .vsix tests", 20 results

Searched for files matching `**/vscode/**`, 144 matches

Searched for files matching `**/README*`, 28 matches

Searched for regex `extension.*host|vscode.*extension|Extension Development Host`, 200 results

Searched for regex `\.vsix|packaging.*vsix|install.*vsix`, 48 results

Searched for regex `extension tests|test.*extension|vscode.*test`, 96 results

Searched for files matching `**/tasks.json`, 1 match

Searched for files matching `**/launch.json`, 2 matches

Read [](file:///home/fran/dev/yuto-code/continue/CONTRIBUTING.md#140-140), lines 140 to 190

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/README.md)

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/e2e/README.md)

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/src/extension.ts)

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/package.json#680-680), lines 680 to 740

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/scripts/package.js)

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/scripts/prepackage.js#1-1), lines 1 to 200

Read [](file:///home/fran/dev/yuto-code/continue/extensions/vscode/scripts/prepackage-cross-platform.js)

Use this repo’s built-in flow. There are two good ways:

1. Run in Extension Development Host (best for daily dev).
2. Package a VSIX and install it into your normal VS Code.

Docs/source references:

- CONTRIBUTING.md
- README.md
- package.json

**Install + run locally (dev mode)**

1. Install dependencies from repo root:
   npm run install-all-dependencies
2. Build/watch extension pieces (from VS Code task runner is easiest):
   - Run task: install-all-dependencies (once)
   - Run task: vscode-extension:build (watch mode stack)
3. Launch extension:
   - Open Run and Debug
   - Choose Launch extension
   - Press Play
4. Test your change in the new Extension Development Host window.
5. For edits in core/extensions, run Command Palette > Reload Window in host window to pick up updates.

**Install as a real extension (VSIX)**

1. Build package:
   cd extensions/vscode
   npm run package
2. This creates a VSIX in extensions/vscode/build.
3. In VS Code:
   - Command Palette > Extensions: Install from VSIX...
   - Select the newest continue-<version>.vsix file.

**Test the changes**
Quick manual smoke test:

1. In Extension Development Host, verify the changed behavior directly.
2. Check logs with command Continue: View Logs if needed.
3. Reload host window after code changes.

Automated e2e (Linux):

1. From extensions/vscode:
   npm run e2e:all-non-mac
2. Faster loops depending on what changed:
   - Only e2e test/config edits: npm run e2e:quick
   - Extension code edits: npm run e2e:recompile-extension
   - GUI edits: npm run e2e:rebuild-gui
