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
import { CodeToEdit } from "core";

export interface CodeToEditListItemProps {
  code: CodeToEdit;
  onDelete: (codeToEdit: CodeToEdit) => void;
  onClickFilename: (codeToEdit: CodeToEdit) => void;
}

// Easiest method to overwrite the top level styling of the markdown preview
const NoPaddingWrapper = styled.div`
  > * {
    margin: 0 !important;
    padding: 0 !important;
  }

  pre {
    margin: 0 !important;
    padding: 0px 0px 0px 10px !important;
  }
`;

export default function CodeToEditListItem({
  code,
  onDelete,
  onClickFilename,
}: CodeToEditListItemProps) {
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  const filepath = code.filepath.split("/").pop() || code.filepath;
  let title = filepath;

  if ("range" in code) {
    const start = code.range.start.line + 1;
    const end = code.range.end.line + 1;
    title +=
      start === end ? ` - Inserting at line ${start}` : ` (${start} - ${end})`;
  }

  const source =
    "```" +
    getMarkdownLanguageTagForFile(code.filepath) +
    "\n" +
    code.contents +
    "\n" +
    "```";

  return (
    <li
      className="group flex cursor-pointer flex-col"
      onClick={() => setShowCodeSnippet((showCodeSnippet) => !showCodeSnippet)}
    >
      <div
        className={`hover:bg-lightgray hover:text-vsc-foreground flex justify-between rounded px-2 py-0.5 transition-colors hover:bg-opacity-20 ${showCodeSnippet && "text-vsc-foreground bg-lightgray bg-opacity-20"}`}
      >
        <div className="flex items-center gap-0.5">
          {showCodeSnippet ? (
            <ChevronDownIcon
              onClick={(e) => {
                e.stopPropagation();
                setShowCodeSnippet(false);
              }}
              className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 hover:bg-opacity-20"
            />
          ) : (
            <ChevronRightIcon
              onClick={(e) => {
                e.stopPropagation();
                setShowCodeSnippet(true);
              }}
              className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 hover:bg-opacity-20"
            />
          )}
          <FileIcon filename={code.filepath} height={"18px"} width={"18px"} />
          <span
            className="text-xs hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onClickFilename(code);
            }}
          >
            {title}
          </span>
        </div>
        <div className="invisible flex gap-1.5 group-hover:visible">
          <XMarkIcon
            onClick={(e) => {
              e.stopPropagation();
              onDelete(code);
            }}
            className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 hover:bg-opacity-20"
          />
        </div>
      </div>

      {showCodeSnippet && (
        <div className="max-h-[25vh] overflow-y-auto px-1 py-2">
          <NoPaddingWrapper>
            <StyledMarkdownPreview source={source} />
          </NoPaddingWrapper>
        </div>
      )}
    </li>
  );
}
