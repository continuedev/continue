import React from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, appear } from ".";

const SubContainerDiv = styled.div`
  margin: 4px;
  padding: 8px;
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};

  animation: ${appear} 0.3s ease-in-out;
`;

function SubContainer(props: { children: React.ReactNode; title: string }) {
  return (
    <SubContainerDiv>
      <b className="mb-12">{props.title}</b>
      <br></br>
      {props.children}
    </SubContainerDiv>
  );
}

export default SubContainer;
