import styled, { keyframes } from "styled-components";

const ellipsisAnimation = keyframes`
  0% { width: 0; }
  33% { width: 0.33em; }
  66% { width: 0.66em; }
  100% { width: 1em; }
`;

export const AnimatedEllipsis = styled.span`
  display: inline-block;
  width: 1em; /* Fixed width to match the maximum animation width */

  &::after {
    content: "...";
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    animation: ${ellipsisAnimation} 2s infinite;
    width: 0;
  }
`;

export default AnimatedEllipsis;
