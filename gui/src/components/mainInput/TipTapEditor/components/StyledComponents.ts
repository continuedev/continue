import styled from "styled-components";
import {
  lightGray,
  vscBadgeBackground,
  vscCommandCenterActiveBorder,
  vscCommandCenterInactiveBorder,
  vscForeground,
  vscInputBackground,
  vscInputBorderFocus,
} from "../../..";
import { getFontSize } from "../../../../util";

export const InputBoxDiv = styled.div<{}>`
  resize: none;
  font-family: inherit;
  border-radius: 0.5rem;
  padding-bottom: 1px;
  margin: 0;
  height: auto;
  background-color: ${vscInputBackground};
  color: ${vscForeground};

  border: 1px solid ${vscCommandCenterInactiveBorder};
  transition:
    border-color 0.18s var(--ruckus-ease),
    box-shadow 0.18s var(--ruckus-ease);

  /* Neutral lift on hover; violet is reserved for focus */
  &:hover:not(:focus-within) {
    border-color: rgb(154 161 181 / 0.45);
  }

  /* Focus reads as a soft violet bloom rather than a hard second border */
  &:focus-within {
    border: 1px solid ${vscCommandCenterActiveBorder};
    box-shadow: 0 0 0 3px rgb(124 92 255 / 0.16);
  }

  outline: none;
  font-size: ${getFontSize()}px;

  &:focus {
    outline: none;
    border: 1px solid ${vscInputBorderFocus};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  display: flex;
  flex-direction: column;
`;

export const HoverDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0.5;
  background-color: ${vscBadgeBackground};
  color: ${vscForeground};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const HoverTextDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  color: ${vscForeground};
  display: flex;
  align-items: center;
  justify-content: center;
`;
