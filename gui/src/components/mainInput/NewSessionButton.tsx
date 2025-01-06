import styled from "styled-components";
import { defaultBorderRadius, vscDescription, vscForeground } from "..";
import { getFontSize } from "../../util";

export const NewSessionButton = styled.div`
  width: fit-content;
  margin-right: auto;
  margin-left: 6px;
  margin-top: 2px;
  margin-bottom: 8px;
  font-size: ${getFontSize() - 2}px;

  border-radius: ${defaultBorderRadius};
  padding: 2px 6px;
  color: ${vscDescription};

  &:hover {
    background-color: ${vscDescription};
    background-opacity: 0.33;
    color: ${vscForeground};
  }

  cursor: pointer;
`;
