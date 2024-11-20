import { RangeInFileWithContents } from "core/commands/util";
import FileIcon from "../../components/FileIcon";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import StyledMarkdownPreview from "../../components/markdown/StyledMarkdownPreview";
import { getMarkdownLanguageTagForFile } from "core/util";

export interface CodeToEditListItemProps {
  rif: RangeInFileWithContents;
  onDelete: (rif: RangeInFileWithContents) => void;
  onClickFilename: (rif: RangeInFileWithContents) => void;
}

export default function CodeToEditListItem({
  rif,
  onDelete,
  onClickFilename,
}: CodeToEditListItemProps) {
  const [showCodeSnippet, setShowCodeSnippet] = useState(true);

  const filepath = rif.filepath.split("/").pop() || rif.filepath;
  const title = `${filepath} (${rif.range.start.line + 1} - ${rif.range.end.line + 1})`;

  const source =
    "```" +
    getMarkdownLanguageTagForFile(rif.filepath) +
    "\n" +
    rif.contents +
    "\n" +
    "```";

  return (
    <li
      className={`flex cursor-pointer flex-col rounded p-1 transition-colors hover:bg-white/10 ${showCodeSnippet && "bg-white/10"}`}
      onClick={() => setShowCodeSnippet((showCodeSnippet) => !showCodeSnippet)}
    >
      {" "}
      <div className="flex justify-between">
        <div className="flex gap-0.5">
          {showCodeSnippet ? (
            <ChevronDownIcon
              onClick={(e) => {
                e.stopPropagation();
                setShowCodeSnippet(false);
              }}
              className="h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 text-gray-400 transition-colors hover:bg-white/10"
            />
          ) : (
            <ChevronRightIcon
              onClick={(e) => {
                e.stopPropagation();
                setShowCodeSnippet(true);
              }}
              className="h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 text-gray-400 transition-colors hover:bg-white/10"
            />
          )}
          <FileIcon filename={rif.filepath} height={"18px"} width={"18px"} />
          <span
            className="hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onClickFilename(rif);
            }}
          >
            {title}
          </span>
        </div>
        <div className="flex gap-1.5">
          <XMarkIcon
            onClick={(e) => {
              e.stopPropagation();
              onDelete(rif);
            }}
            className="h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 text-gray-400 transition-colors hover:bg-white/10"
          />
        </div>
      </div>
      {showCodeSnippet && (
        <div className="max-h-[15vh] overflow-y-auto">
          <StyledMarkdownPreview source={source} />
        </div>
      )}
    </li>
  );
}
