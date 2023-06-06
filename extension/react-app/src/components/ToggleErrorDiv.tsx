import React, { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius } from ".";

// Should be a toggleable div with red border and light red background that displays a main message and detail inside

interface ToggleErrorDivProps {
  title: string;
  error: string;
}

const TopDiv = styled.div`
  border: 1px solid red;
  background-color: #ff000020;
  padding: 8px;

  border-radius: ${defaultBorderRadius};
  cursor: pointer;
`;

const ToggleErrorDiv = (props: ToggleErrorDivProps) => {
  const [open, setOpen] = useState(false);
  return (
    <TopDiv
      onClick={() => {
        setOpen(!open);
      }}
    >
      <div className="flex flex-row">
        <div className="flex-grow">
          <p>
            {open ? "▼" : "▶"} {props.title}
          </p>
        </div>
      </div>
      {open && <pre className="overflow-scroll">{props.error}</pre>}
    </TopDiv>
  );
};

export default ToggleErrorDiv;
