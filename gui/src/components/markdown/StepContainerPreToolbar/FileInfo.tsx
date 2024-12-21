import FileIcon from "../../FileIcon";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLastNPathParts, getUriPathBasename } from "core/util/uri";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";

export interface FileInfoProps {
  relativeFilepath: string;
  range?: string;
}

const FileInfo = ({ relativeFilepath, range }: FileInfoProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  async function onClickFileName() {
    const fileUri = await inferResolvedUriFromRelativePath(
      relativeFilepath,
      ideMessenger.ide,
    );
    ideMessenger.post("showFile", {
      filepath: fileUri,
    });
  }

  return (
    <div className="flex w-full min-w-0 items-center">
      <div
        className="mr-0.5 flex w-full min-w-0 cursor-pointer items-center gap-0.5"
        onClick={onClickFileName}
      >
        <FileIcon height="20px" width="20px" filename={relativeFilepath} />
        <span className="w-full truncate hover:underline">
          {getLastNPathParts(relativeFilepath, 1)}
          {range && ` ${range}`}
        </span>
      </div>
    </div>
  );
};

export default FileInfo;
