import { extToLangMap } from ".";
import { Range } from "..";
import { getFileExtensionFromBasename, getUriPathBasename } from "./uri";
export function formatCodeblock(
  relativePathOrBasename: string,
  contents: string,
  extension?: string,
  range?: Range | string,
) {
  const basename = getUriPathBasename(relativePathOrBasename);
  const ext = extension || getFileExtensionFromBasename(basename);
  const languageTag = extToLangMap[ext] || ext || basename;

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
