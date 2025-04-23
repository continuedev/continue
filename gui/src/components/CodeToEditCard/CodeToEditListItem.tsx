import {
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CodeToEdit } from "core";
import { getMarkdownLanguageTagForFile } from "core/util";
import {
  getLastNUriRelativePathParts,
  getUriPathBasename,
} from "core/util/uri";
import { useState } from "react";
import styled from "styled-components";
import FileIcon from "../FileIcon";
import StyledMarkdownPreview from "../StyledMarkdownPreview";

export interface CodeToEditListItemProps {
  code: CodeToEdit;
  onDelete: (codeToEdit: CodeToEdit) => void | Promise<void>;
  onClickFilename: (codeToEdit: CodeToEdit) => void | Promise<void>;
}

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

  const fileName = getUriPathBasename(code.filepath);
  const last2Parts = getLastNUriRelativePathParts(
    window.workspacePaths ?? [],
    code.filepath,
    2,
  );

  let isInsertion = false;
  let title = fileName;

  if ("range" in code) {
    const start = code.range.start.line + 1;
    const end = code.range.end.line + 1;

    isInsertion = start === end;

    title += isInsertion
      ? ` - Inserting at line ${start}`
      : ` (${start} - ${end})`;
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
      onClick={() => {
        if (!isInsertion) {
          setShowCodeSnippet((showCodeSnippet) => !showCodeSnippet);
        }
      }}
    >
      <div
        className={`hover:bg-lightgray hover:text-vsc-foreground flex items-center justify-between rounded px-2 py-0.5 transition-colors hover:bg-opacity-20 ${showCodeSnippet && "text-vsc-foreground bg-lightgray bg-opacity-20"}`}
      >
        <div className="flex w-4/5 min-w-0 items-center gap-0.5">
          <FileIcon filename={code.filepath} height={"18px"} width={"18px"} />
          <div className="flex min-w-0 gap-1.5">
            <span
              className="flex-shrink-0 text-xs hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                void onClickFilename(code);
              }}
            >
              {title}
            </span>
            <span className="text-lightgray invisible flex-grow truncate text-xs group-hover:visible">
              {last2Parts}
            </span>
          </div>
        </div>

        <div className="invisible flex items-center group-hover:visible">
          <div className={`flex items-center ${isInsertion ? "hidden" : ""}`}>
            {showCodeSnippet ? (
              <ChevronDownIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCodeSnippet(false);
                }}
                className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-sm p-0.5 hover:bg-opacity-20"
              />
            ) : (
              <ChevronRightIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCodeSnippet(true);
                }}
                className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-sm p-0.5 hover:bg-opacity-20"
              />
            )}
          </div>
          <div className="flex items-center">
            <XMarkIcon
              onClick={(e) => {
                e.stopPropagation();
                void onDelete(code);
              }}
              className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-sm p-0.5 hover:bg-opacity-20"
            />
          </div>
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
