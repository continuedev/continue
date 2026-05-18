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
  outline: 1px solid transparent;
  outline-offset: 0;
  transition:
    border-color 0.15s ease-in-out,
    outline-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;
  &:focus-within {
    border: 1px solid ${vscCommandCenterActiveBorder};
    outline-color: ${vscInputBorderFocus};
    box-shadow: 0 0 0 2px ${vscInputBorderFocus}33;
  }

  font-size: ${getFontSize()}px;

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
