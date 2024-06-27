import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from "../../components";

export const StyledButton = styled(Button)<{ blurColor?: string }>`
  background-color: transparent;
  color: ${vscForeground};
  border: 0.5px solid ${lightGray};

  &:hover {
    border: 1px solid ${lightGray};
    background-color: ${lightGray}22;
  }
`;

export const Div = styled.div<{
  selected: boolean;
}>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  transition: all 0.5s;
  padding-left: 16px;
  padding-right: 16px;

  &:hover {
    background-color: ${lightGray}22;
    box-shadow: 0 0 4px 0px ${lightGray};
    cursor: pointer;
  }

  ${(props) =>
    props.selected &&
    `
    background-color: ${lightGray}22;
    box-shadow: 0 0 4px 0px ${lightGray};
    `}
`;
