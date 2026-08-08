import styled, { css, keyframes } from "styled-components";

const DEFAULT_DIAMETER = 6;

const blink = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
`;

const blinkAnimation = css`
  animation: ${blink} 3s infinite;
`;

const BlinkingDot = styled.div<{
  color: string;
  diameter?: number;
  shouldBlink?: boolean;
}>`
  background-color: ${(props) => props.color};
  box-shadow: 0px 0px 2px 1px ${(props) => props.color};
  width: ${(props) => props.diameter ?? DEFAULT_DIAMETER}px;
  height: ${(props) => props.diameter ?? DEFAULT_DIAMETER}px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.75);
  margin: 0 2px;
  ${(props) => (props.shouldBlink ?? false) && blinkAnimation};
`;

export default BlinkingDot;
