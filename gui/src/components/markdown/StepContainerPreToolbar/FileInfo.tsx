import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { getBasename } from "core/util";
import FileIcon from "../../FileIcon";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export interface FileInfoProps {
  filepath: string;
  range?: string;
}

const FileInfo = ({ filepath, range }: FileInfoProps) => {
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
        className="flex cursor-pointer items-center gap-1"
        onClick={onClickFileName}
      >
        <FileIcon height="20px" width="20px" filename={filepath} />
        <span className="truncate hover:underline">
          {getBasename(filepath)}
          {range && ` ${range}`}
        </span>
      </div>
    </div>
  );
};

export default FileInfo;
