import {
  AtSymbolIcon,
  PhotoIcon,
  SlashIcon,
} from "@heroicons/react/24/outline";
import { InputModifiers } from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { useRef } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBadgeBackground,
  vscBadgeForeground,
  vscForeground,
  vscInputBackground,
} from "..";
import { selectUseActiveFile } from "../../redux/selectors";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import ModelSelect from "../modelSelection/ModelSelect";
import { ToolTip } from "../gui/Tooltip";

const StyledDiv = styled.div<{ isHidden: boolean }>`
  padding: 4px 0;
  justify-content: space-between;
  gap: 1px;
  background-color: ${vscInputBackground};
  align-items: center;
  font-size: ${getFontSize() - 2}px;
  cursor: ${(props) => (props.isHidden ? "default" : "text")};
  opacity: ${(props) => (props.isHidden ? 0 : 1)};
  pointer-events: ${(props) => (props.isHidden ? "none" : "auto")};
  user-select: none;

  & > * {
    flex: 0 0 auto;
  }
`;

const HoverItem = styled.span<{ isActive?: boolean }>`
  padding: 0 4px;
  padding-top: 2px;
  padding-bottom: 2px;
  cursor: pointer;
  transition:
    color 200ms,
    background-color 200ms,
    box-shadow 200ms;
`;

const EnterButton = styled.button`
  all: unset;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  background-color: ${lightGray}33;
  border-radius: ${defaultBorderRadius};
  color: ${vscForeground};
  cursor: pointer;
  :disabled {
    cursor: wait;
  }
`;

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onAddSlashCommand?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
  disabled?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultModel = useSelector(defaultModelSelector);
  const useActiveFile = useSelector(selectUseActiveFile);

  const supportsImages =
    defaultModel &&
    modelSupportsImages(
      defaultModel.provider,
      defaultModel.model,
      defaultModel.title,
      defaultModel.capabilities,
    );

  return (
    <>
      <StyledDiv
        isHidden={props.hidden}
        onClick={props.onClick}
        id="input-toolbar"
        className="flex"
      >
        <div className="flex items-center justify-start gap-2 whitespace-nowrap">
          <ModelSelect />
          <div className="xs:flex -mb-1 hidden items-center gap-1 text-gray-400 transition-colors duration-200">
            {supportsImages && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                  onChange={(e) => {
                    for (const file of e.target.files) {
                      props.onImageFileSelected(file);
                    }
                  }}
                />
                <HoverItem>
                  <PhotoIcon
                    className="h-4 w-4"
                    onClick={(e) => {
                      fileInputRef.current?.click();
                    }}
                  />
                </HoverItem>
              </>
            )}

            <HoverItem onClick={props.onAddContextItem}>
              <AtSymbolIcon
                data-tooltip-id="add-context-item-tooltip"
                className="h-4 w-4"
              />

              <ToolTip id="add-context-item-tooltip" place="top-start">
                Add context (files, docs, urls, etc.)
              </ToolTip>
            </HoverItem>
          </div>
        </div>

        <div className="flex items-center gap-2 whitespace-nowrap text-gray-400">
          <div className="hidden transition-colors duration-200 hover:underline sm:flex">
            {props.activeKey === "Alt" ? (
              <HoverItem className="underline">
                {`${getAltKeyLabel()}⏎ 
                  ${useActiveFile ? "No active file" : "Active file"}`}
              </HoverItem>
            ) : (
              <HoverItem
                className={props.activeKey === "Meta" && "underline"}
                onClick={(e) =>
                  props.onEnter({
                    useCodebase: true,
                    noContext: !useActiveFile,
                  })
                }
              >
                <span data-tooltip-id="add-codebase-context-tooltip">
                  {getMetaKeyLabel()}⏎ @codebase
                </span>
                <ToolTip id="add-codebase-context-tooltip" place="top-end">
                  Submit with the codebase as context ({getMetaKeyLabel()}⏎)
                </ToolTip>
              </HoverItem>
            )}
          </div>

          <EnterButton
            onClick={(e) => {
              props.onEnter({
                useCodebase: isMetaEquivalentKeyPressed(e as any),
                noContext: useActiveFile ? e.altKey : !e.altKey,
              });
            }}
            disabled={props.disabled}
          >
            <span className="hidden md:inline">⏎ Enter</span>
            <span className="md:hidden">⏎</span>
          </EnterButton>
        </div>
      </StyledDiv>
    </>
  );
}

export default InputToolbar;
