import { PhotoIcon as OutlinePhotoIcon } from "@heroicons/react/24/outline";
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
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap-reverse;
  flex-direction: row-reverse;
  gap: 1px;
  background-color: ${vscInputBackground};
  align-items: center;
  z-index: 50;
  font-size: ${getFontSize() - 4}px;
  cursor: ${props => props.isHidden ? 'default' : 'text'};
  opacity: ${props => props.isHidden ? 0 : 1};
  pointer-events: ${props => props.isHidden ? 'none' : 'auto'};

  & > * {
    flex: 0 0 auto;
  }
`;

const EnterButton = styled.div<{ offFocus: boolean }>`
  padding: 2px 4px;
  display: flex;
  align-items: center;

  background-color: ${(props) =>
    props.offFocus ? undefined : lightGray + "33"};
  border-radius: ${defaultBorderRadius};
  color: ${vscForeground};

  &:hover {
    background-color: ${vscBadgeBackground};
    color: ${vscBadgeForeground};
  }

  cursor: pointer;
`;

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  usingCodebase?: boolean;
  onAddContextItem?: () => void;

  onClick?: () => void;

  onImageFileSelected?: (file: File) => void;

  hidden?: boolean;
  showNoContext: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileSelectHovered, setFileSelectHovered] = useState(false);

  const defaultModel = useSelector(defaultModelSelector);
  const useActiveFile = useSelector(selectUseActiveFile);

  return (
    <>
      <StyledDiv
        isHidden={props.hidden}
        onClick={props.onClick}
        id="input-toolbar"
      >
        <span className="flex items-center whitespace-nowrap">
          {props.showNoContext ? (
            <span
              style={{
                color: props.usingCodebase ? vscBadgeBackground : lightGray,
                backgroundColor: props.usingCodebase
                  ? lightGray + "33"
                  : undefined,
                borderRadius: defaultBorderRadius,
                padding: "2px 4px",
              }}
            >
              {getAltKeyLabel()} ⏎{" "}
              {useActiveFile ? "No context" : "Use active file"}
            </span>
          ) : (
            <span
              style={{
                color: props.usingCodebase ? vscBadgeBackground : lightGray,
                backgroundColor: props.usingCodebase
                  ? lightGray + "33"
                  : undefined,
                borderRadius: defaultBorderRadius,
                padding: "2px 4px",
              }}
              onClick={(e) => {
                props.onEnter({
                  useCodebase: true,
                  noContext: !useActiveFile,
                });
              }}
              className={"hover:underline cursor-pointer float-right"}
            >
              {getMetaKeyLabel()} ⏎ Use codebase
            </span>
          )}
          <EnterButton
            offFocus={props.usingCodebase}
            // disabled={
            //   !active &&
            //   (!(inputRef.current as any)?.value ||
            //     typeof client === "undefined")
            // }
            onClick={(e) => {
              props.onEnter({
                useCodebase: isMetaEquivalentKeyPressed(e),
                noContext: useActiveFile ? e.altKey : !e.altKey,
              });
            }}
          >
            ⏎ Enter
          </EnterButton>
        </span>
        <span className="flex flex-wrap-reverse gap-1 items-center whitespace-nowrap">
          <ModelSelect />
          <span
            style={{
              color: lightGray,
            }}
            onClick={(e) => {
              props.onAddContextItem();
            }}
            className="hover:underline cursor-pointer"
          >
            + Add Context
          </span>
          {defaultModel &&
            modelSupportsImages(
              defaultModel.provider,
              defaultModel.model,
              defaultModel.title,
            ) && (
              <span
                className="ml-1 mt-0.5"
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
                    width="1.4em"
                    height="1.4em"
                    color={lightGray}
                    onClick={(e) => {
                      fileInputRef.current?.click();
                    }}
                  />
                ) : (
                  <OutlinePhotoIcon
                    width="1.4em"
                    height="1.4em"
                    color={lightGray}
                    onClick={(e) => {
                      fileInputRef.current?.click();
                    }}
                  />
                )}
              </span>
            )}
        </span>
      </StyledDiv>
    </>
  );
}

export default InputToolbar;
