import FileIcon from "../../FileIcon";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getFileName } from "core/util/uri";

export interface FileInfoProps {
  filepath: string;
  range?: string;
}

const FileInfo = ({ filepath, range }: FileInfoProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  function onClickFileName() {
    ideMessenger.post("showFile", {
      filepath,
    });
  }

  return (
    <div className="flex w-full min-w-0 items-center">
      <div
        className="mr-0.5 flex w-full min-w-0 cursor-pointer items-center gap-0.5"
        onClick={onClickFileName}
      >
        <FileIcon height="20px" width="20px" filename={filepath} />
        <span className="w-full truncate hover:underline">
          {getFileName(filepath)}
          {range && ` ${range}`}
        </span>
      </div>
    </div>
  );
};

export default FileInfo;
