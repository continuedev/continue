import React from "react";
import styled from "styled-components";

const StyledDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: linear-gradient(
    101.79deg,
    #12887a 0%,
    #87245c 32%,
    #e12637 63%,
    #ffb215 100%
  );
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 10;
`;

const StyledImg = styled.img`
  /* add your styles here */
`;

const StyledDiv2 = styled.div`
  width: 50%;
  height: 5px;
  background: white;
  margin-top: 20px;
`;

interface LoadingCoverProps {
  message: string;
  hidden?: boolean;
}

const LoadingCover = (props: LoadingCoverProps) => {
  return (
    <StyledDiv style={{ display: props.hidden ? "none" : "inherit" }}>
      <StyledImg src="continue.gif" alt="centered image" width="50%" />
      <StyledDiv2></StyledDiv2>
      <p>{props.message}</p>
    </StyledDiv>
  );
};

export default LoadingCover;
