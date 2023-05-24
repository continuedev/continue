import { useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  MainContainerWithBorder,
  secondaryDark,
  vscBackground,
} from ".";
import { RangeInFile, FileEdit } from "../../../src/client";
import CodeBlock from "./CodeBlock";
import SubContainer from "./SubContainer";

import { ChevronDown, ChevronRight } from "@styled-icons/heroicons-outline";

export interface IterationContext {
  codeSelections: RangeInFile[];
  instruction: string;
  suggestedChanges: FileEdit[];
  status: "waiting" | "accepted" | "rejected";
  summary?: string;
  action: string;
  error?: string;
}

interface IterationContainerProps {
  iterationContext: IterationContext;
}

const IterationContainerDiv = styled.div<{ open: boolean }>`
  background-color: ${(props) => (props.open ? vscBackground : secondaryDark)};
  border-radius: ${defaultBorderRadius};
  padding: ${(props) => (props.open ? "2px" : "8px")};
`;

function IterationContainer(props: IterationContainerProps) {
  const [open, setOpen] = useState(false);

  return (
    <MainContainerWithBorder className="m-2 overflow-hidden">
      <IterationContainerDiv open={open}>
        <p
          className="m-2 cursor-pointer"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <ChevronDown size="1.4em" /> : <ChevronRight size="1.4em" />}
          {props.iterationContext.summary ||
            props.iterationContext.codeSelections
              .map((cs) => cs.filepath)
              .join("\n")}
        </p>

        {open && (
          <>
            <SubContainer title="Action">
              {props.iterationContext.action}
            </SubContainer>
            {props.iterationContext.error && (
              <SubContainer title="Error">
                <CodeBlock>{props.iterationContext.error}</CodeBlock>
              </SubContainer>
            )}
            {props.iterationContext.suggestedChanges.map((sc) => {
              return (
                <SubContainer title="Suggested Change">
                  {sc.filepath}
                  <CodeBlock>{sc.replacement}</CodeBlock>
                </SubContainer>
              );
            })}
          </>
        )}
      </IterationContainerDiv>
    </MainContainerWithBorder>
  );
}

export default IterationContainer;
