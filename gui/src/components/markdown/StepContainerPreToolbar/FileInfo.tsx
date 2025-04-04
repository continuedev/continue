import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { getLastNPathParts } from "core/util/uri";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import FileIcon from "../../FileIcon";

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
    <div
      className="flex cursor-pointer flex-row items-center gap-0.5"
      onClick={onClickFileName}
    >
      <div>
        <FileIcon height="20px" width="20px" filename={relativeFilepath} />
      </div>
      <span className="line-clamp-1 break-all hover:underline">
        asdfasdfasdfasdfasdfasdfasdf
        {getLastNPathParts(relativeFilepath, 1)}
        {range && ` ${range}`}
      </span>
    </div>
  );
};

export default FileInfo;
