import { RangeInFile } from "core";
import { useContext, useMemo } from "react";
import { getBasename } from "core/util";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import FileIcon from "../FileIcon";
import { ToolTip } from "../gui/Tooltip";
import { v4 as uuidv4 } from "uuid";

interface FilenameLinkProps {
  rif: RangeInFile;
}

function FilenameLink({ rif }: FilenameLinkProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function onClick() {
    ideMessenger.post("showLines", {
      filepath: rif.filepath,
      startLine: rif.range.start.line,
      endLine: rif.range.end.line,
    });
  }

  const id = uuidv4();

  return (
    <>
      <span
        data-tooltip-id={id}
        className="mx-[0.1em] mb-[0.15em] inline-flex cursor-pointer items-center gap-0.5 rounded-md pr-[0.2em] align-middle hover:ring-1"
        onClick={onClick}
      >
        <FileIcon filename={rif.filepath} height="20px" width="20px" />
        <span className="mb-0.5 align-baseline underline underline-offset-2">
          {getBasename(rif.filepath)}
        </span>
      </span>
      <ToolTip id={id} place="top">
        {rif.filepath}
      </ToolTip>
    </>
  );
}

export default FilenameLink;
