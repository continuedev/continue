import { RangeInFile } from "core";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useContext } from "react";
import { getBasename } from "core/util";
import FileIcon from "../FileIcon";

interface FilenameLinkProps {
  rif: RangeInFile;
}

function FilenameLink({ rif }: FilenameLinkProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function onClick() {
    debugger;
    ideMessenger.post("showLines", {
      filepath: rif.filepath,
      startLine: rif.range.start.line,
      endLine: rif.range.end.line,
    });
  }

  return (
    <div
      className="inline-flex items-center align-middle hover:bg-stone-800 rounded-md py-0.5 pl-0 pr-1 mb-0.5 cursor-pointer gap-0.5"
      onClick={onClick}
    >
      <FileIcon filename={rif.filepath} height="20px" width="20px" />
      <span className="align-middle underline underline-offset-2 decoration-gray-600">
        {getBasename(rif.filepath)}
      </span>
    </div>
  );
}

export default FilenameLink;
