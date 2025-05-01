import { AtSymbolIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { InputModifiers } from "core";
import { modelSupportsImages, modelSupportsTools } from "core/llm/autodetect";
import { useContext, useRef } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseActiveFile } from "../../redux/selectors";
import {
  selectCurrentToolCall,
  selectCurrentToolCallApplyState,
} from "../../redux/selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { exitEditMode } from "../../redux/thunks/editMode";
import {
  getAltKeyLabel,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import { ToolTip } from "../gui/Tooltip";
import ModelSelect from "../modelSelection/ModelSelect";
import ModeSelect from "../modelSelection/ModeSelect";
import { useFontSize } from "../ui/font";
import { EnterButton } from "./InputToolbar/EnterButton";
import HoverItem from "./InputToolbar/HoverItem";

export interface ToolbarOptions {
  hideUseCodebase?: boolean;
  hideImageUpload?: boolean;
  hideAddContext?: boolean;
  enterText?: string;
  hideSelectModel?: boolean;
}

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
  toolbarOptions?: ToolbarOptions;
  disabled?: boolean;
  isMainInput?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultModel = useAppSelector(selectSelectedChatModel);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const mode = useAppSelector((store) => store.session.mode);
  const codeToEdit = useAppSelector((store) => store.editModeState.codeToEdit);
  const toolCallState = useAppSelector(selectCurrentToolCall);
  const currentToolCallApplyState = useAppSelector(
    selectCurrentToolCallApplyState,
  );

  const isEnterDisabled =
    props.disabled ||
    (mode === "edit" && codeToEdit.length === 0) ||
    toolCallState?.status === "generated" ||
    (currentToolCallApplyState &&
      currentToolCallApplyState.status !== "closed");

  const toolsSupported = defaultModel && modelSupportsTools(defaultModel);

  const supportsImages =
    defaultModel &&
    modelSupportsImages(
      defaultModel.provider,
      defaultModel.model,
      defaultModel.title,
      defaultModel.capabilities,
    );

  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  return (
    <>
      <div
        onClick={props.onClick}
        className={`find-widget-skip bg-vsc-input-background flex select-none flex-row items-center justify-between gap-1 pt-1 ${props.hidden ? "pointer-events-none h-0 cursor-default opacity-0" : "pointer-events-auto cursor-text opacity-100"}`}
        style={{
          fontSize: smallFont,
        }}
      >
        <div className="xs:gap-1.5 flex flex-row items-center gap-1">
          <HoverItem data-tooltip-id="mode-select-tooltip" className="!p-0">
            <ModeSelect />
            <ToolTip id="mode-select-tooltip" place="top">
              Select Mode
            </ToolTip>
          </HoverItem>
          <HoverItem data-tooltip-id="model-select-tooltip" className="!p-0">
            <ModelSelect />
            <ToolTip id="model-select-tooltip" place="top">
              Select Model
            </ToolTip>
          </HoverItem>
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
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  />
                  <HoverItem className="">
                    <PhotoIcon
                      className="h-3 w-3 hover:brightness-125"
                      data-tooltip-id="image-tooltip"
                      onClick={(e) => {
                        fileInputRef.current?.click();
                      }}
                    />

                    <ToolTip id="image-tooltip" place="top">
                      Attach Image
                    </ToolTip>
                  </HoverItem>
                </>
              ))}
            {props.toolbarOptions?.hideAddContext || (
              <HoverItem onClick={props.onAddContextItem}>
                <AtSymbolIcon
                  data-tooltip-id="add-context-item-tooltip"
                  className="h-3 w-3 hover:brightness-125"
                />

                <ToolTip id="add-context-item-tooltip" place="top">
                  Attach Context
                </ToolTip>
              </HoverItem>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-2 whitespace-nowrap text-gray-400"
          style={{
            fontSize: tinyFont,
          }}
        >
          {!props.toolbarOptions?.hideUseCodebase && mode !== "edit" && (
            <div
              className={`${toolsSupported ? "md:flex" : "int:flex"} hover:underline" hidden transition-colors duration-200`}
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
                    Send With Codebase as Context ({getMetaKeyLabel()}⏎)
                  </ToolTip>
                </HoverItem>
              )}
            </div>
          )}

          {mode === "edit" && (
            <HoverItem
              className="hidden hover:underline sm:flex"
              onClick={async () => {
                dispatch(exitEditMode({}));
                ideMessenger.post("focusEditor", undefined);
              }}
            >
              <span>
                <i>Esc</i> to exit
              </span>
            </HoverItem>
          )}

          <EnterButton
            data-tooltip-id="enter-tooltip"
            isPrimary={props.isMainInput}
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
            <ToolTip id="enter-tooltip" place="top">
              Send (⏎)
            </ToolTip>
          </EnterButton>
        </div>
      </div>
    </>
  );
}

export default InputToolbar;
