import React from "react";
import styled, { keyframes } from "styled-components";
import { vscForeground } from "..";

const rotate = keyframes`
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 12;
  }
`;

const LoaderSvg = styled.svg<{
  width?: string;
  height?: string;
  period?: number;
}>`
  transform: rotate(-90deg);
  width: ${(props) => props.width || "40px"};
  height: ${(props) => props.height || "40px"};
  opacity: 50%;

  circle {
    fill: none;
    stroke: ${vscForeground};
    stroke-width: 2;
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
    animation: ${rotate} ${(props) => props.period || 6}s ease-out infinite;
    stroke-linecap: round;
  }
`;

const RingLoader = (props: {
  size: number;
  wFull?: boolean;
  className?: string;
  width?: string;
  height?: string;
  period?: number;
}) => {
  const viewBox = `0 0 ${props.size} ${props.size}`;
  const size = (props.size / 2).toString();
  const r = "14"; //(props.size / 2 - 2).toString();
  return (
    <div
      className={
        "m-auto mt-2 text-center" +
        (props.wFull === false ? "" : " w-full") +
        " " +
        props.className
      }
    >
      <LoaderSvg
        period={props.period}
        width={props.width}
        height={props.height}
        viewBox={viewBox}
      >
        <circle cx={size} cy={size} r={r} />
      </LoaderSvg>
    </div>
  );
};

export default RingLoader;
