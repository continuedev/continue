import { IDE } from "..";

export async function grepSearchDirs(
  query: string,
  ide: IDE,
  dirUris?: string[],
): Promise<string> {
  const dirsToSearch = dirUris ?? (await ide.getWorkspaceDirs());
  const results: string[] = [];
  for (const dir of dirsToSearch) {
    const dirResults = ""; //await _searchDir(query, dir);

    const keepLines: string[] = [];

    function countLeadingSpaces(line: string) {
      return line?.match(/^ */)?.[0].length ?? 0;
    }

    // function formatLine(line: string, sectionIndent: number): string {
    //   return line.replace(new RegExp(`^[ ]{0,${sectionIndent}}`), "");
    // }

    let leading = false;
    let sectionIndent = 0;
    // let sectionTrim = 0;
    for (const line of dirResults.split("\n").filter((l) => !!l)) {
      if (line.startsWith("./") || line === "--") {
        leading = true;
        keepLines.push(line);
        continue;
      }

      if (leading) {
        // Exclude leading single-char lines
        if (line.trim().length > 1) {
          // Record spacing at first non-single char line
          leading = false;
          sectionIndent = countLeadingSpaces(line);
          keepLines.push(line);
        }
        continue;
      }
      // Exclude trailing
      // TODO may exclude wanted results for lines that look like
      // ./filename
      //      thisThing
      //   relevantThing
      //
      if (countLeadingSpaces(line) >= sectionIndent) {
        keepLines.push(line);
      }
    }
    results.push(keepLines.join("\n"));
  }

  return results.join("\n\n");
}

//   private async _searchDir(query: string, dir: string): Promise<string> {
//     const relativeDir = vscode.Uri.parse(dir).fsPath;
//     const ripGrepUri = vscode.Uri.joinPath(
//       getExtensionUri(),
//       "out/node_modules/@vscode/ripgrep/bin/rg",
//     );
//     const p = child_process.spawn(
//       ripGrepUri.fsPath,
//       [
//         "-i", // Case-insensitive search
//         "-C",
//         "2", // Show 2 lines of context
//         "--heading", // Only show filepath once per result
//         "-e",
//         query, // Pattern to search for
//         ".", // Directory to search in
//       ],
//       { cwd: relativeDir },
//     );
//     let output = "";

//     p.stdout.on("data", (data) => {
//       output += data.toString();
//     });

//     return new Promise<string>((resolve, reject) => {
//       p.on("error", reject);
//       p.on("close", (code) => {
//         if (code === 0) {
//           resolve(output);
//         } else if (code === 1) {
//           // No matches
//           resolve("No matches found");
//         } else {
//           reject(new Error(`Process exited with code ${code}`));
//         }
//       });
//     });
//   }
