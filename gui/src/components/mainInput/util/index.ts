import { SetCodeToEditPayload } from "core";
import { getUriPathBasename } from "core/util/uri";

export function getEditFilenameAndRangeText(code: SetCodeToEditPayload) {
  const fileName = getUriPathBasename(code.filepath);
  let title = `${fileName}`;

  if ("range" in code) {
    const start = code.range.start.line + 1;
    const end = code.range.end.line + 1;
    const isInsertion = start === end;
    title += isInsertion
      ? ` - Inserting at line ${start}`
      : ` (${start} - ${end})`;
  }

  return title;
}
