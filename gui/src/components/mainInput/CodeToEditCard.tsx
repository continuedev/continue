import { ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { CodeToEdit } from "core";
import { getMarkdownLanguageTagForFile } from "core/util";
import { getUriPathBasename } from "core/util/uri";
import { useContext, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { clearCodeToEdit } from "../../redux/slices/editModeState";
import { getMetaKeyLabel } from "../../util";
import FileIcon from "../FileIcon";
import StyledMarkdownPreview from "../StyledMarkdownPreview";
import { useFontSize } from "../ui/font";

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

interface CodeToEditItemProps {
  code: CodeToEdit;
}

function CodeToEditItem({ code }: CodeToEditItemProps) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  function onDelete() {
    dispatch(clearCodeToEdit());
    ideMessenger.post("edit/clearDecorations", undefined);
  }

  const fileName = getUriPathBasename(code.filepath);

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

  async function onClickFilename() {
    if ("range" in code) {
      await ideMessenger.ide.showLines(
        code.filepath,
        code.range.start.line,
        code.range.end.line,
      );
    } else {
      await ideMessenger.ide.openFile(code.filepath);
    }
  }

  const smallFont = useFontSize(-3);

  const iconClass =
    "text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-sm p-0.5 hover:bg-opacity-20";

  return (
    <div className="flex flex-col gap-1 py-0.5">
      <div className="group flex flex-row items-center justify-start gap-1.5 px-1">
        <span
          className="hidden flex-shrink-0 pl-2 font-semibold text-gray-400 sm:flex"
          style={{
            fontSize: smallFont,
          }}
        >
          Code to edit
        </span>
        {/* <CodeBracketIcon className="h-3 w-3 flex-shrink-0 text-gray-400 sm:hidden" /> */}
        <div
          className={`hover:bg-lightgray flex flex-1 cursor-pointer items-center justify-between rounded transition-colors hover:bg-opacity-20 ${showCodeSnippet && "bg-lightgray bg-opacity-20"}`}
          onClick={() => {
            if (!isInsertion) {
              setShowCodeSnippet((showCodeSnippet) => !showCodeSnippet);
            }
          }}
        >
          <div className="flex items-center gap-0.5">
            <FileIcon filename={code.filepath} height={"18px"} width={"18px"} />
            <span
              className="line-clamp-1 text-xs hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                void onClickFilename();
              }}
            >
              {title}
            </span>
          </div>

          <div className="invisible flex items-center group-hover:visible">
            <ChevronRightIcon
              onClick={(e) => {
                e.stopPropagation();
                setShowCodeSnippet((val) => !val);
              }}
              className={`text-lightgray hover:bg-lightgray hover:text-vsc-foreground h-3.5 w-3.5 cursor-pointer rounded-sm p-0.5 hover:bg-opacity-20 ${showCodeSnippet ? "rotate-90" : ""} ${isInsertion ? "hidden" : ""}`}
            />
            <div className="flex items-center">
              <XMarkIcon
                onClick={(e) => {
                  e.stopPropagation();
                  void onDelete();
                }}
                className={iconClass}
              />
            </div>
          </div>
        </div>
      </div>
      {showCodeSnippet && (
        <div className="!m-0 max-h-48 overflow-y-auto !p-0">
          <NoPaddingWrapper>
            <StyledMarkdownPreview source={source} />
          </NoPaddingWrapper>
        </div>
      )}
    </div>
  );
}
export default function CodeToEditCard() {
  // Array from previous multi-file edit
  const codeToEditArray = useAppSelector(
    (state) => state.editModeState.codeToEdit,
  );
  const codeToEdit = useMemo(() => {
    return codeToEditArray[0];
  }, [codeToEditArray]);

  const metaKeyLabel = useMemo(() => {
    return getMetaKeyLabel();
  }, []);

  const tinyFont = useFontSize(-3);

  return (
    <div className="bg-vsc-editor-background mx-3 flex flex-col rounded-t-lg py-1">
      {codeToEdit ? (
        <CodeToEditItem code={codeToEdit} />
      ) : (
        <>
          <span
            className="text-balance px-3 text-center font-semibold text-gray-400"
            style={{
              fontSize: tinyFont,
            }}
          >
            {`To edit code, highlight it and press `}
            <kbd>{metaKeyLabel}</kbd> <kbd>I</kbd>
          </span>
        </>
      )}
    </div>
  );
}
