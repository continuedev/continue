import React from "react";
import styled, { keyframes } from "styled-components";
import { buttonColor, vscBackground, vscForeground } from ".";

const rotate = keyframes`
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 12;
  }
`;

const LoaderSvg = styled.svg`
  transform: rotate(-90deg);
  width: 40px;
  height: 40px;
  opacity: 50%;

  circle {
    fill: none;
    stroke: ${vscForeground};
    stroke-width: 2;
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
    animation: ${rotate} 6s ease-out infinite;
    stroke-linecap: round;
  }
`;

const RingLoader = () => (
  <div className="m-auto w-full text-center">
    <LoaderSvg viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" />
    </LoaderSvg>
  </div>
);

export default RingLoader;
