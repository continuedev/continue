// Write a component that displays a dialog box with a text field and a button.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Button, secondaryDark, vscBackground, vscForeground } from ".";
import { isMetaEquivalentKeyPressed } from "../util";

const ScreenCover = styled.div`
  position: absolute;
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
  padding: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px 0 ${vscForeground};
  width: fit-content;
  margin: auto;
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
  onEnter: (text: string) => void;
  onClose: () => void;
  message?: string;
}) => {
  const [text, setText] = useState("");
  const textAreaRef = React.createRef<HTMLTextAreaElement>();

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [props.showDialog]);

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
          <P>{props.message || ""}</P>
          <TextArea
            rows={10}
            ref={textAreaRef}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                isMetaEquivalentKeyPressed(e) &&
                textAreaRef.current
              ) {
                props.onEnter(textAreaRef.current.value);
                setText("");
              } else if (e.key === "Escape") {
                props.onClose();
              }
            }}
          />
          <Button
            onClick={() => {
              if (textAreaRef.current) {
                props.onEnter(textAreaRef.current.value);
                setText("");
              }
            }}
          >
            Enter
          </Button>
        </Dialog>
      </DialogContainer>
    </ScreenCover>
  );
};

export default TextDialog;
