// Write a component that displays a dialog box with a text field and a button.
import React, { useState } from "react";
import styled from "styled-components";
import { Button, buttonColor, secondaryDark, vscBackground } from ".";

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
`;

const P = styled.p`
  color: black;
  margin: 8px auto;
`;

const TextDialog = (props: {
  showDialog: boolean;
  onEnter: (text: string) => void;
}) => {
  const [text, setText] = useState("");
  const textAreaRef = React.createRef<HTMLTextAreaElement>();

  return (
    <DialogContainer hidden={!props.showDialog}>
      <Dialog>
        <P>Thanks for your feedback. We'll get back to you soon!</P>
        <TextArea cols={50} rows={10} ref={textAreaRef}></TextArea>
        <Button
          onClick={() => {
            if (textAreaRef.current) {
              props.onEnter(textAreaRef.current.value);
            }
          }}
        >
          Enter
        </Button>
      </Dialog>
    </DialogContainer>
  );
};

export default TextDialog;
