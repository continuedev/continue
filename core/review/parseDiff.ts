export function getDiffPerFile(diff: string): { [filepath: string]: string } {
  /**
     * Example of the lines before the diff for each file:
     a/core/index.d.ts b/core/index.d.ts
     index 18f88a2c..719fd6d2 100644
     --- a/core/index.d.ts
     +++ b/core/index.d.ts
     */
  const perFile: { [filepath: string]: string } = {};

  const parts = diff.split("diff --git ").slice(1);
  for (const part of parts) {
    const lines = part.split("\n");
    // Splitting a line like this: `a/core/index.d.ts b/core/index.d.ts`
    const filepath = lines[0].slice(2).split(" ")[0];
    const diff = lines.slice(4).join("\n");
    perFile[filepath] = diff;
  }

  return perFile;
}

export function getChangedFiles(diff: string): string[] {
  const parts = diff.split("diff --git ").slice(1);
  return parts.map((part) => part.split("\n")[0].slice(2).split(" ")[0]);
}
