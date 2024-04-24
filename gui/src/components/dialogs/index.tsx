import React, { isValidElement, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import {
  VSC_BACKGROUND_VAR,
  defaultBorderRadius,
  parseColorForHex,
  vscBackground,
  vscFocusBorder,
  vscForeground,
  vscInputBackground,
} from "..";

const ScreenCover = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: ${parseColorForHex(VSC_BACKGROUND_VAR)}aa;
  z-index: 1000;
`;

const DialogContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 75%;
`;

const Dialog = styled.div`
  color: ${vscForeground};
  background-color: ${vscBackground};
  border-radius: ${defaultBorderRadius};
  display: flex;
  flex-direction: column;
  border: 1px solid ${vscFocusBorder};
  margin: auto;
  word-wrap: break-word;
  overflow: hidden;
`;

const TextArea = styled.textarea`
  border: 1px solid #ccc;
  border-radius: ${defaultBorderRadius};
  padding: 8px;
  outline: 1px solid black;
  resize: none;
  background-color: ${vscInputBackground};
  color: ${vscForeground};

  &:focus {
    outline: 1px solid ${vscForeground};
  }
`;

const P = styled.p`
  color: ${vscForeground};
  margin: 8px auto;
`;

const TextDialog = (props: {
  showDialog: boolean;
  onEnter: () => void;
  onClose: () => void;
  message?: string | JSX.Element;
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props]);

  if (!isValidElement(props.message) && typeof props.message !== "string") {
    return null;
  }

  return (
    <ScreenCover
      onClick={() => {
        props.onClose();
      }}
      hidden={!props.showDialog}
    >
      <DialogContainer
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Dialog>
          {typeof props.message === "string" ? (
            <ReactMarkdown>{props.message || ""}</ReactMarkdown>
          ) : !React.isValidElement(props.message) ? null : (
            props.message
          )}
        </Dialog>
      </DialogContainer>
    </ScreenCover>
  );
};

export default TextDialog;
