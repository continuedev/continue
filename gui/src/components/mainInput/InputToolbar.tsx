import {
  AtSymbolIcon,
  PhotoIcon as OutlinePhotoIcon,
} from "@heroicons/react/24/outline";
import { PhotoIcon as SolidPhotoIcon } from "@heroicons/react/24/solid";
import { InputModifiers } from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { useRef, useState } from "react";
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
  transition: color 200ms;

  &:hover {
    color: #d1d5db;
  }
`;

const EnterButton = styled.div`
  padding: 2px 4px;
  display: flex;
  align-items: center;
  background-color: ${lightGray}33;
  border-radius: ${defaultBorderRadius};
  color: ${vscForeground};
  cursor: pointer;

  &:hover {
    background-color: ${vscBadgeBackground};
    color: ${vscBadgeForeground};
  }
`;

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
}

function InputToolbar(props: InputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileSelectHovered, setFileSelectHovered] = useState(false);

  const defaultModel = useSelector(defaultModelSelector);
  const useActiveFile = useSelector(selectUseActiveFile);

  console.log(props.activeKey);

  return (
    <>
      <StyledDiv
        isHidden={props.hidden}
        onClick={props.onClick}
        id="input-toolbar"
        className="hidden xs:flex"
      >
        <div className="flex gap-2 items-center whitespace-nowrap justify-start">
          <div>
            <ModelSelect />
          </div>
          <div className="items-center hidden xs:flex">
            <HoverItem
              onClick={props.onAddContextItem}
              className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
            >
              <AtSymbolIcon className="h-4 w-4" aria-hidden="true" />
            </HoverItem>

            {defaultModel &&
              modelSupportsImages(
                defaultModel.provider,
                defaultModel.model,
                defaultModel.title,
                defaultModel.capabilities,
              ) && (
                <span
                  className="ml-1 -mb-0.5 cursor-pointer"
                  onMouseLeave={() => setFileSelectHovered(false)}
                  onMouseEnter={() => setFileSelectHovered(true)}
                >
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
                  {fileSelectHovered ? (
                    <SolidPhotoIcon
                      className="h-4 w-4 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                      onClick={(e) => {
                        fileInputRef.current?.click();
                      }}
                    />
                  ) : (
                    <OutlinePhotoIcon
                      className="h-4 w-4 text-gray-400 hover:text-gray-300 transition-colors duration-200"
                      onClick={(e) => {
                        fileInputRef.current?.click();
                      }}
                    />
                  )}
                </span>
              )}
          </div>
        </div>

        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="hidden sm:flex">
            {props.activeKey === "Alt" ? (
              <HoverItem>
                {`${getAltKeyLabel()}⏎ 
                  ${useActiveFile ? "No active file" : "Active file"}`}
              </HoverItem>
            ) : (
              <HoverItem
                className={
                  props.activeKey === "Meta"
                    ? "text-gray-300"
                    : "text-gray-400 hover:text-gray-300 transition-colors duration-200"
                }
                onClick={(e) =>
                  props.onEnter({
                    useCodebase: true,
                    noContext: !useActiveFile,
                  })
                }
              >
                <span className="hidden md:inline">
                  {" "}
                  {getMetaKeyLabel()}⏎ @codebase
                </span>
                <span className="md:hidden">@codebase</span>
              </HoverItem>
            )}
          </div>

          <EnterButton
            onClick={(e) => {
              props.onEnter({
                useCodebase: isMetaEquivalentKeyPressed(e),
                noContext: useActiveFile ? e.altKey : !e.altKey,
              });
            }}
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
