import styled, { keyframes } from "styled-components";

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

/**
 * Ruckus streaming sweep — violet through indigo to azure and back, so the
 * band reads as one hue in motion rather than a rainbow. Kept in sync with
 * the accent tokens in styles/theme.ts.
 */
const STREAMING_SWEEP = `repeating-linear-gradient(
      101.79deg,
      #6344e8 0%,
      #7c5cff 18%,
      #a78bfa 34%,
      #5b9dff 50%,
      #a78bfa 66%,
      #7c5cff 82%,
      #6344e8 100%
    )`;

export const GradientBorder = styled.div<{
  borderRadius?: string;
  borderColor?: string;
  loading: 0 | 1;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 1px;
  background: ${(props) => props.borderColor || STREAMING_SWEEP};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: ${(props) => (props.loading ? "8px" : "")};
  /* Soft violet bloom while streaming, nothing at rest */
  box-shadow: ${(props) =>
    props.loading ? "0 0 18px -6px rgb(124 92 255 / 0.55)" : "none"};
  transition:
    box-shadow 0.25s var(--ruckus-ease),
    background 0.25s var(--ruckus-ease);
`;
