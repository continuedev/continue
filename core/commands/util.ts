import { ContextItemWithId, RangeInFileWithContents } from "../";
import { getRelativePath, getUriPathBasename } from "../util/uri";
import { v4 as uuidv4 } from "uuid";

export function rifWithContentsToContextItem(
  rif: RangeInFileWithContents,
): ContextItemWithId {
  const basename = getUriPathBasename(rif.filepath);
  const relativePath = getRelativePath(
    rif.filepath,
    window.workspacePaths ?? [],
  );
  const rangeStr = `(${rif.range.start.line + 1}-${rif.range.end.line + 1})`;

  const itemName = `${basename} ${rangeStr}`;
  return {
    content: rif.contents,
    name: itemName,
    description: `${relativePath} ${rangeStr}`, // This is passed to the LLM - do not pass full URI
    id: {
      providerTitle: "code",
      itemId: uuidv4(),
    },
    uri: {
      type: "file",
      value: rif.filepath,
    },
  };
}

export function ctxItemToRifWithContents(
  item: ContextItemWithId,
): RangeInFileWithContents {
  let startLine = 0;
  let endLine = 0;

  const nameSplit = item.name.split("(");

  if (nameSplit.length > 1) {
    const lines = nameSplit[1].split(")")[0].split("-");
    startLine = Number.parseInt(lines[0], 10);
    endLine = Number.parseInt(lines[1], 10);
  }

  const rif: RangeInFileWithContents = {
    filepath: item.uri?.value || "",
    range: {
      start: {
        line: startLine,
        character: 0,
      },
      end: {
        line: endLine,
        character: 0,
      },
    },
    contents: item.content,
  };

  return rif;
}
