import { PhotoIcon as OutlinePhotoIcon } from "@heroicons/react/24/outline";
import { PhotoIcon as SolidPhotoIcon } from "@heroicons/react/24/solid";
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
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";

const StyledDiv = styled.div<{ hidden?: boolean }>`
  position: absolute;
  display: flex;
  gap: 4px;
  right: 4px;
  bottom: 4px;
  width: calc(100% - 10px);
  background-color: ${vscInputBackground};

  ${(props) => (props.hidden ? "display: none;" : "")}

  align-items: center;
  z-index: 50;
  font-size: 10px;

  cursor: text;

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
  onEnter?: () => void;
  useCodebase?: () => void;
  usingCodebase?: boolean;
  onAddContextItem?: () => void;

  onClick?: () => void;

  onImageFileSelected?: (file: File) => void;

  hidden?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileSelectHovered, setFileSelectHovered] = useState(false);

  const defaultModel = useSelector(defaultModelSelector);

  return (
    <StyledDiv hidden={props.hidden} onClick={props.onClick} id="input-toolbar">
      <span className="cursor-pointer mr-auto flex items-center">
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
          modelSupportsImages(defaultModel.provider, defaultModel.model) && (
            <span
              className="ml-1.5 mt-0.5"
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
      {/* <span
        style={{
          color: props.usingCodebase ? vscBadgeBackground : lightGray,
          backgroundColor: props.usingCodebase ? lightGray + "33" : undefined,
          borderRadius: defaultBorderRadius,
          padding: "2px 4px",
        }}
        onClick={props.useCodebase}
        className={"hover:underline cursor-pointer float-right"}
      >
        {getMetaKeyLabel()} ⏎ Use Codebase
      </span> */}

      <EnterButton
        offFocus={props.usingCodebase}
        // disabled={
        //   !active &&
        //   (!(inputRef.current as any)?.value ||
        //     typeof client === "undefined")
        // }
        onClick={props.onEnter}
      >
        ⏎ Enter
      </EnterButton>
    </StyledDiv>
  );
}

export default InputToolbar;
