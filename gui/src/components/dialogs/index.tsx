import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import {
  CloseButton,
  defaultBorderRadius,
  vscBackground,
  vscForeground,
} from "..";

interface TextDialogProps {
  showDialog: boolean;
  onEnter: () => void;
  onClose: () => void;
  message?: string | JSX.Element;
}

const ScreenCover = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(0.5px);
  z-index: 100000;
  flex-direction: column;
`;

const DialogContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${vscForeground};
  background-color: ${vscBackground};
  border-radius: ${defaultBorderRadius};
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  word-wrap: break-word;
`;

const TextDialog = (props: TextDialogProps) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      props.onClose();
    }
  };

  if (!isValidElement(props.message) && typeof props.message !== "string") {
    return null;
  }

  return (
    <ScreenCover
      onClick={props.onClose}
      hidden={!props.showDialog}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <DialogContainer
        className="xs:w-[90%] no-scrollbar max-h-[95%] w-[92%] max-w-[600px] overflow-auto sm:w-[88%] md:w-[80%]"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <CloseButton onClick={props.onClose}>
          <XMarkIcon className="z-50 h-5 w-5 hover:brightness-125" />
        </CloseButton>

        {typeof props.message === "string" ? (
          <ReactMarkdown>{props.message || ""}</ReactMarkdown>
        ) : !React.isValidElement(props.message) ? null : (
          props.message
        )}
      </DialogContainer>
    </ScreenCover>
  );
};

export default TextDialog;
