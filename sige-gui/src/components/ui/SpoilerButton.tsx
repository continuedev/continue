import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground } from "../index";
import { getFontSize } from "../../util";

export const SpoilerButton = styled.div`
  background-color: ${vscBackground};
  width: fit-content;
  margin: 8px 6px 0px 2px;
  font-size: ${getFontSize() - 2}px;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  color: ${lightGray};
  cursor: pointer;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow:
      0 6px 8px rgba(0, 0, 0, 0.15),
      0 3px 6px rgba(0, 0, 0, 0.1);
  }
`;

export const ButtonContent = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;
