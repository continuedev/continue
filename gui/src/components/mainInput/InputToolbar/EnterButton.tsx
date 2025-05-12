import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
  vscForeground,
} from "../..";
import { fontSize } from "../../../util";

export const EnterButton = styled.button<{ isPrimary?: boolean }>`
  all: unset;
  font-size: ${fontSize(-3)};
  padding: 2px 4px;
  display: flex;
  align-items: center;
  background-color: ${(props) =>
    !props.disabled && props.isPrimary
      ? vscButtonBackground
      : lightGray + "33"};
  border-radius: ${defaultBorderRadius};
  color: ${(props) =>
    !props.disabled && props.isPrimary ? vscButtonForeground : vscForeground};
  cursor: pointer;

  :disabled {
    cursor: not-allowed;
  }
`;
