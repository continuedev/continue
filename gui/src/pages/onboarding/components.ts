import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscForeground,
} from "../../components";

export const StyledButton = styled(Button)`
  margin-left: auto;
  background-color: transparent;
  color: ${vscForeground};
  border: 0.5px solid ${lightGray};

  &:hover {
    ${(props) =>
      !props.disabled && `box-shadow: 0 0 4px 4px ${vscButtonBackground};`}
  }
`;

export const Div = styled.div<{
  color: string;
  disabled: boolean;
  hovered: boolean;
  selected: boolean;
}>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  transition: all 0.5s;
  padding-left: 16px;
  padding-right: 16px;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : props.hovered || props.selected
      ? `
    border: 1px solid ${props.color};
    background-color: ${props.color}22;
    cursor: pointer;`
      : ""}

  ${(props) =>
    props.selected
      ? `
    box-shadow: 0 0 4px 0px ${props.color};
    `
      : ""}
`;
