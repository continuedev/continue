import {
  ChevronDownIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { dedent, getMarkdownLanguageTagForFile } from "core/util";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import StyledMarkdownPreview from "./StyledMarkdownPreview";
import { ctxItemToRifWithContents } from "core/commands/util";
import { EyeIcon } from "@heroicons/react/24/solid";
import { useAppSelector } from "../../redux/hooks";

const PreviewMarkdownDiv = styled.div<{
  borderColor?: string;
}>`
  background-color: ${vscEditorBackground};
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${(props) => props.borderColor || lightGray};
  margin-top: 4px;
  margin-bottom: 4px;
  overflow: hidden;
  position: relative;

  & div {
    background-color: ${vscEditorBackground};
  }
`;

interface CodeSnippetPreviewProps {
  item: ContextItemWithId;
  onDelete?: () => void;
  borderColor?: string;
  inputId: string;
}

const MAX_PREVIEW_HEIGHT = 100;

const backticksRegex = /`{3,}/gm;

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [localHidden, setLocalHidden] = useState<boolean | undefined>();
  const [isSizeLimited, setIsSizeLimited] = useState(true);

  const newestCodeblockForInputId = useAppSelector(
    (store) => store.session.newestCodeblockForInput[props.inputId],
  );

  const hidden = useMemo(() => {
    return localHidden ?? newestCodeblockForInputId !== props.item.id.itemId;
  }, [localHidden, newestCodeblockForInputId, props.item]);

  const content = useMemo(() => {
    return dedent`${props.item.content}`;
  }, [props.item.content]);

  const fence = useMemo(() => {
    const backticks = content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [content]);

  const codeBlockRef = useRef<HTMLDivElement>(null);

  const [codeblockDims, setCodeblockDims] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setCodeblockDims({
        width: codeBlockRef.current?.scrollWidth ?? 0,
        height: codeBlockRef.current?.scrollHeight ?? 0,
      });
    });

    if (codeBlockRef.current) {
      resizeObserver.observe(codeBlockRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [codeBlockRef]);

  return (
    <PreviewMarkdownDiv
      spellCheck={false}
      borderColor={props.borderColor}
      className="find-widget-skip"
    >
      <div
        className="m-0 flex cursor-pointer items-center justify-between break-all border-b px-[5px] py-1.5 hover:opacity-90"
        style={{
          fontSize: getFontSize() - 3,
        }}
        onClick={() => {
          setLocalHidden(!hidden);
        }}
      >
        <div
          className="flex items-center gap-1 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            if (
              props.item.id.providerTitle === "file" &&
              props.item.uri?.value
            ) {
              ideMessenger.post("showFile", {
                filepath: props.item.uri.value,
              });
            } else if (props.item.id.providerTitle === "code") {
              const rif = ctxItemToRifWithContents(props.item, true);
              ideMessenger.ide.showLines(
                rif.filepath,
                rif.range.start.line,
                rif.range.end.line,
              );
            } else {
              ideMessenger.post("showVirtualFile", {
                content,
                name: props.item.name,
              });
            }
          }}
        >
          <FileIcon height="16px" width="16px" filename={props.item.name} />
          {props.item.name}
        </div>
        <div className="flex items-center gap-1">
          <HeaderButtonWithToolTip text={hidden ? "Show" : "Hide"}>
            {hidden ? (
              <EyeIcon width="1em" height="1em" />
            ) : (
              <EyeSlashIcon width="1em" height="1em" />
            )}
          </HeaderButtonWithToolTip>
          <HeaderButtonWithToolTip
            text="Delete"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete?.();
            }}
          >
            <XMarkIcon width="1em" height="1em" />
          </HeaderButtonWithToolTip>
        </div>
      </div>
      <div
        contentEditable={false}
        className={`m-0 ${isSizeLimited ? "overflow-hidden" : "overflow-auto"} ${hidden ? "hidden" : ""}`}
        ref={codeBlockRef}
        style={{
          maxHeight: isSizeLimited ? MAX_PREVIEW_HEIGHT : undefined, // Could switch to max-h-[33vh] but then chevron icon shows when height can't change
        }}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(props.item.name)} ${props.item.description}\n${content}\n${fence}`}
        />
      </div>

      {codeblockDims.height > MAX_PREVIEW_HEIGHT && (
        <HeaderButtonWithToolTip
          className="absolute bottom-1 right-2"
          text={isSizeLimited ? "Expand" : "Collapse"}
        >
          <ChevronDownIcon
            className="h-5 w-5 transition-all"
            style={{
              transform: isSizeLimited ? "" : "rotate(180deg)",
            }}
            onClick={() => setIsSizeLimited((v) => !v)}
          />
        </HeaderButtonWithToolTip>
      )}
    </PreviewMarkdownDiv>
  );
}

export default CodeSnippetPreview;
