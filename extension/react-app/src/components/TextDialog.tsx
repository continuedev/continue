// Write a component that displays a dialog box with a text field and a button.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Button, buttonColor, secondaryDark, vscBackground } from ".";

const ScreenCover = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgba(168, 168, 168, 0.5);
`;

const DialogContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Dialog = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  /* box-shadow: 0 0 10px 0 rgba(255, 255, 255, 0.5); */
  border: 2px solid ${buttonColor};
  width: fit-content;
  margin: auto;
`;

const TextArea = styled.textarea`
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 8px;
  outline: 1px solid black;
  font-family: Arial, Helvetica, sans-serif;
  resize: none;

  &:focus {
    outline: 1px solid ${buttonColor};
  }
`;

const P = styled.p`
  color: black;
  margin: 8px auto;
`;

const TextDialog = (props: {
  showDialog: boolean;
  onEnter: (text: string) => void;
  onClose: () => void;
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
          <P>Thanks for your feedback. We'll get back to you soon!</P>
          <TextArea
            cols={50}
            rows={10}
            ref={textAreaRef}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey && textAreaRef.current) {
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
