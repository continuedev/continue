// Write a component that displays a dialog box with a text field and a button.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Button, secondaryDark, vscBackground, vscForeground } from ".";
import { isMetaEquivalentKeyPressed } from "../util";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";

const ScreenCover = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  background-color: rgba(168, 168, 168, 0.5);
  z-index: 100;
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
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px 0 ${vscForeground};
  margin: auto;
  word-wrap: break-word;
  overflow: hidden;
`;

const TextArea = styled.textarea`
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 8px;
  outline: 1px solid black;
  resize: none;
  background-color: ${secondaryDark};
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
          ) : (
            props.message
          )}
        </Dialog>
      </DialogContainer>
    </ScreenCover>
  );
};

export default TextDialog;
