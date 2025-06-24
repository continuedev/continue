import { extToLangMap } from ".";
import { Range } from "..";
import { getFileExtensionFromBasename } from "./uri";
export function formatCodeblock(
  relativePathOrBasename: string,
  contents: string,
  extension?: string,
  range?: Range | string,
) {
  const ext = extension || getFileExtensionFromBasename(relativePathOrBasename);
  const languageTag = extToLangMap[ext] ?? ext;

  const path = relativePathOrBasename.startsWith("/")
    ? relativePathOrBasename
    : `/${relativePathOrBasename}`;

  const rangeString = range
    ? typeof range === "string"
      ? range
      : `(${range.start.line + 1}-${range.end.line + 1})`
    : "";
  const codeblockHeader = `${languageTag} ${path} ${rangeString}`
    .replaceAll("  ", " ")
    .trim();

  return `\`\`\`${codeblockHeader}\n${contents}\n\`\`\``;
}
