import { RangeInFile } from "core";
import { useContext } from "react";
import { getBasename } from "core/util";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import FileIcon from "../FileIcon";

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

  return (
    <div
      className="mb-0.5 inline-flex cursor-pointer items-center gap-0.5 rounded-md py-0.5 pl-0 pr-1 align-middle hover:bg-stone-800"
      onClick={onClick}
    >
      <FileIcon filename={rif.filepath} height="20px" width="20px" />
      <span className="align-middle underline decoration-gray-600 underline-offset-2">
        {getBasename(rif.filepath)}
      </span>
    </div>
  );
}

export default FilenameLink;
