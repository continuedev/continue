import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { getBasename } from "core/util";
import FileIcon from "../../FileIcon";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export interface FileInfoProps {
  filepath: string;
  isExpanded: boolean;
  onClickExpand: () => void;
  numLines: number;
}

const FileInfo = ({
  filepath,
  isExpanded,
  onClickExpand,
  numLines,
}: FileInfoProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  // TODO: Need to turn into relative or fq path
  function onClickFileName() {
    ideMessenger.post("showFile", {
      filepath,
    });
  }

  return (
    <div className="flex max-w-[20%] items-center">
      <div
        onClick={onClickExpand}
        className="flex cursor-pointer items-center justify-center"
      >
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </div>
      <div
        className="flex cursor-pointer items-center gap-1"
        onClick={onClickFileName}
      >
        <FileIcon height="20px" width="20px" filename={filepath} />
        <span className="mr-1 truncate">{getBasename(filepath)}</span>
        <span className="truncate text-xs text-stone-500">
          ({numLines} lines)
        </span>
      </div>
    </div>
  );
};

export default FileInfo;
