import { RangeInFileWithContents } from "core/commands/util";
import FileIcon from "../../components/FileIcon";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import StyledMarkdownPreview from "../../components/markdown/StyledMarkdownPreview";
import { getMarkdownLanguageTagForFile } from "core/util";
import styled from "styled-components";

export interface CodeToEditListItemProps {
  rif: RangeInFileWithContents;
  onDelete: (rif: RangeInFileWithContents) => void;
  onClickFilename: (rif: RangeInFileWithContents) => void;
}

// Easiest method to overwrite the top level styling of the markdown preview
const NoPaddingWrapper = styled.div`
  > * {
    margin: 0 !important;
    padding: 0 !important;
  }

  pre {
    margin: 0 !important;
    padding: 0 !important;
  }
`;

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
      className="flex cursor-pointer flex-col rounded border border-solid border-neutral-500 shadow-sm transition-transform"
      onClick={() => setShowCodeSnippet((showCodeSnippet) => !showCodeSnippet)}
    >
      <div
        className={`flex justify-between px-2 py-1 ${showCodeSnippet ? "border-x-0 border-b border-t-0 border-solid border-neutral-500" : ""}`}
      >
        <div className="flex items-center gap-0.5">
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
            className="text-xs hover:underline"
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
        <div className="max-h-[15vh] overflow-y-auto px-1 py-2">
          <NoPaddingWrapper>
            <StyledMarkdownPreview source={source} />
          </NoPaddingWrapper>
        </div>
      )}
    </li>
  );
}
