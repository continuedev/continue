import React, { useRef } from "react";
import styled from "styled-components";
import { vscBackground, vscForeground } from ".";

interface InputAndButtonProps {
  onUserInput: (input: string) => void;
}

const TopDiv = styled.div`
  display: grid;
  grid-template-columns: 3fr 1fr;
  grid-gap: 0;
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid white;
  background-color: ${vscBackground};
  color: ${vscForeground};
  border-radius: 4px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  outline: none;
`;

const Button = styled.button`
  padding: 0.5rem;
  border: 1px solid white;
  background-color: ${vscBackground};
  color: ${vscForeground};
  border-radius: 4px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 0;
  cursor: pointer;

  &:hover {
    background-color: ${vscForeground};
    color: ${vscBackground};
  }
`;

function InputAndButton(props: InputAndButtonProps) {
  const userInputRef = useRef<HTMLInputElement>(null);

  return (
    <TopDiv className="grid grid-cols-2 space-x-0">
      <Input
        ref={userInputRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            props.onUserInput(e.currentTarget.value);
          }
        }}
        type="text"
        onSubmit={(ev) => {
          props.onUserInput(ev.currentTarget.value);
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
      <Button
        onClick={(e) => {
          if (userInputRef.current) {
            props.onUserInput(userInputRef.current.value);
          }
          e.stopPropagation();
        }}
      >
        Enter
      </Button>
    </TopDiv>
  );
}

export default InputAndButton;
