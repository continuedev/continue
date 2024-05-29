import { Listbox } from "@headlessui/react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscButtonBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from "../..";

export const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
`;

export const StyledListboxButton = styled(Listbox.Button)`
  cursor: pointer;
  background-color: ${vscBackground};
  text-align: left;

  padding-left: 0.75rem;
  padding-right: 2.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;

  border-radius: 0.5em;
  border: 1px solid ${vscButtonBackground};

  margin: 0;
  height: 100%;
  width: 100%;

  position: relative;

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  color: ${vscForeground};

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: ${vscInputBackground};
  }
`;

export const StyledListboxOptions = styled(Listbox.Options)`
  background-color: ${vscInputBackground};
  padding: 0;

  position: absolute;
  top: 100%;
  left: 0;
  right: 0;

  margin-top: 0.25rem;

  max-height: 15rem;
  overflow: auto;

  border-radius: ${defaultBorderRadius};
  overflow-y: scroll;
  z-index: 10;

  &:focus {
    outline: none;
  }
`;

export const StyledListboxOption = styled(Listbox.Option)<{
  selected: boolean;
}>`
  background-color: ${({ selected }) =>
    selected ? vscListActiveBackground : vscInputBackground};
  cursor: pointer;
  padding: 6px 8px;

  display: flex;
  gap: 8px;
  align-items: center;

  &:hover {
    background-color: ${vscListActiveBackground};
    color: ${vscListActiveForeground};
  }
`;
