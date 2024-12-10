import { AtSymbolIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { InputModifiers } from "core";
import { modelSupportsImages, modelSupportsTools } from "core/llm/autodetect";
import { useRef } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
  vscInputBackground,
} from "..";
import { selectUseActiveFile } from "../../redux/selectors";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import { ToolTip } from "../gui/Tooltip";
import ModelSelect from "../modelSelection/ModelSelect";
import HoverItem from "./InputToolbar/HoverItem";
import ToggleToolsButton from "./InputToolbar/ToggleToolsButton";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import {
  selectHasCodeToEdit,
  selectIsInEditMode,
} from "../../redux/slices/sessionSlice";
import { exitEditMode } from "../../redux/thunks";
import { loadLastSession } from "../../redux/thunks/session";

const StyledDiv = styled.div<{ isHidden?: boolean }>`
  padding-top: 4px;
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

export interface ToolbarOptions {
  hideUseCodebase?: boolean;
  hideImageUpload?: boolean;
  hideAddContext?: boolean;
  enterText?: string;
  hideSelectModel?: boolean;
  hideTools?: boolean;
}

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onAddSlashCommand?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
  toolbarOptions?: ToolbarOptions;
  disabled?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultModel = useAppSelector(selectDefaultModel);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const hasCodeToEdit = useAppSelector(selectHasCodeToEdit);
  const isEditModeAndNoCodeToEdit = isInEditMode && !hasCodeToEdit;
  const isEnterDisabled = props.disabled || isEditModeAndNoCodeToEdit;
  const shouldRenderToolsButton =
    defaultModel &&
    modelSupportsTools(defaultModel.model) &&
    !props.toolbarOptions?.hideTools;

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
        className="find-widget-skip flex"
      >
        <div className="flex items-center justify-start gap-2 whitespace-nowrap">
          <ModelSelect />
          <div className="xs:flex -mb-1 hidden items-center text-gray-400 transition-colors duration-200">
            {props.toolbarOptions?.hideImageUpload ||
              (supportsImages && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                    onChange={(e) => {
                      const files = e.target?.files ?? [];
                      for (const file of files) {
                        props.onImageFileSelected?.(file);
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
              ))}
            {props.toolbarOptions?.hideAddContext || (
              <HoverItem onClick={props.onAddContextItem}>
                <AtSymbolIcon
                  data-tooltip-id="add-context-item-tooltip"
                  className="h-4 w-4"
                />

                <ToolTip id="add-context-item-tooltip" place="top-start">
                  Add context (files, docs, urls, etc.)
                </ToolTip>
              </HoverItem>
            )}

            {shouldRenderToolsButton && <ToggleToolsButton />}
          </div>
        </div>

        <div className="flex items-center gap-2 whitespace-nowrap text-gray-400">
          {props.toolbarOptions?.hideUseCodebase || (
            <div
              className={`${shouldRenderToolsButton ? "md:flex" : "sm:flex"} hover:underline" hidden transition-colors duration-200`}
            >
              {props.activeKey === "Alt" ? (
                <HoverItem className="underline">
                  {`${getAltKeyLabel()}⏎
                  ${useActiveFile ? "No active file" : "Active file"}`}
                </HoverItem>
              ) : (
                <HoverItem
                  className={props.activeKey === "Meta" ? "underline" : ""}
                  onClick={(e) =>
                    props.onEnter?.({
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
          )}

          {isInEditMode && (
            <HoverItem
              className="hidden hover:underline sm:flex"
              onClick={async (e) => {
                await dispatch(
                  loadLastSession({
                    saveCurrentSession: false,
                  }),
                );
                dispatch(exitEditMode());
              }}
            >
              <span>
                <i>Esc</i> to exit
              </span>
            </HoverItem>
          )}

          <EnterButton
            data-testid="submit-input-button"
            onClick={async (e) => {
              if (props.onEnter) {
                props.onEnter({
                  useCodebase: isMetaEquivalentKeyPressed(e as any),
                  noContext: useActiveFile ? e.altKey : !e.altKey,
                });
              }
            }}
            disabled={isEnterDisabled}
          >
            <span className="hidden md:inline">
              ⏎ {props.toolbarOptions?.enterText ?? "Enter"}
            </span>
            <span className="md:hidden">⏎</span>
          </EnterButton>
        </div>
      </StyledDiv>
    </>
  );
}

export default InputToolbar;
