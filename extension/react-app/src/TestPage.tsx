import React from "react";
import styled from "styled-components";

const SideBySideDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  grid-template-areas: "left right";
`;

const LeftDiv = styled.div`
  grid-area: left;
`;

const RightDiv = styled.div`
  grid-area: right;
`;

function TestPage() {
  return (
    <div>
      <h1>Continue</h1>
      <SideBySideDiv>
        <LeftDiv>
          <h2>Left</h2>
        </LeftDiv>
        <RightDiv>
          <h2>Right</h2>
        </RightDiv>
      </SideBySideDiv>
    </div>
  );
}
