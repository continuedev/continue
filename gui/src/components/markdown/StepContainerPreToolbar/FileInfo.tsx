import { getLastNPathParts } from "core/util/uri";
import FileIcon from "../../FileIcon";

export interface FileInfoProps {
  filepath: string;
  onClick: () => void;
  range?: string;
}

export const FileInfo = ({ filepath, range, onClick }: FileInfoProps) => {
  return (
    <div
      className="flex cursor-pointer flex-row items-center gap-0.5"
      onClick={onClick}
    >
      <div>
        <FileIcon height="20px" width="20px" filename={filepath} />
      </div>
      <span className="line-clamp-1 break-all hover:underline">
        {getLastNPathParts(filepath, 1)}
        {range && ` ${range}`}
      </span>
    </div>
  );
};
