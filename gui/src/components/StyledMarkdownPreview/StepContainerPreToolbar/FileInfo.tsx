import { getLastNPathParts } from "core/util/uri";
import FileIcon from "../../FileIcon";
import { ToolTip } from "../../gui/Tooltip";

export interface FileInfoProps {
  filepath: string;
  onClick?: () => void;
  range?: string;
}

const TOOLTIP_ID = "file-info-tooltip";

export const FileInfo = ({ filepath, range, onClick }: FileInfoProps) => {
  return (
    <>
      <div
        className={`flex select-none flex-row items-center gap-0.5 ${onClick && "cursor-pointer hover:underline"}`}
        onClick={onClick}
        data-tooltip-id={TOOLTIP_ID}
        data-tooltip-content={filepath}
        data-tooltip-place="top-end"
      >
        <div>
          <FileIcon height="20px" width="20px" filename={filepath} />
        </div>
        <span className="line-clamp-1 break-all">
          {getLastNPathParts(filepath, 1)}
          {range && ` ${range}`}
        </span>
      </div>
      <ToolTip
        id={TOOLTIP_ID}
        style={{
          maxWidth: "200px",
          textAlign: "left",
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      />
    </>
  );
};
