import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { isValidElement, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import {
  CloseButton,
  VSC_BACKGROUND_VAR,
  defaultBorderRadius,
  lightGray,
  parseColorForHex,
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
  background-color: ${parseColorForHex(VSC_BACKGROUND_VAR)}aa;
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
  border: 1px solid ${lightGray};
  word-wrap: break-word;
`;

const TextDialog = (props: TextDialogProps) => {
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
    <ScreenCover onClick={props.onClose} hidden={!props.showDialog}>
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
