import { Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Dispatch, Fragment, SetStateAction } from "react";
import { Listbox } from "@headlessui/react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscButtonBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from "..";

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
  border: 1px solid ${lightGray};

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

interface DisplayInfo {
  title: string;
  icon?: string;
}

interface ModelSelectionListboxProps {
  selectedProvider: DisplayInfo;
  setSelectedProvider: Dispatch<SetStateAction<DisplayInfo>>;
  options: DisplayInfo[];
}

function ModelSelectionListbox({
  selectedProvider,
  setSelectedProvider,
  options,
}: ModelSelectionListboxProps) {
  return (
    <StyledListbox value={selectedProvider} onChange={setSelectedProvider}>
      <div className="relative mt-1 mb-2">
        <StyledListboxButton>
          <span className="flex items-center">
            {window.vscMediaUrl && selectedProvider.icon && (
              <img
                src={`${window.vscMediaUrl}/logos/${selectedProvider.icon}`}
                height="24px"
                style={{ marginRight: "10px" }}
              />
            )}
            <span className="text-md">{selectedProvider.title}</span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </StyledListboxButton>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <StyledListboxOptions>
            {options.map((option, index) => (
              <StyledListboxOption
                selected={selectedProvider.title === option.title}
                key={index}
                className={({ active }: { active: boolean }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? "bg-amber-100 text-amber-900" : "text-gray-900"
                  }`
                }
                value={option}
              >
                {({ selected }) => (
                  <>
                    {window.vscMediaUrl && option.icon && (
                      <img
                        src={`${window.vscMediaUrl}/logos/${option.icon}`}
                        height="24px"
                        style={{ marginRight: "10px" }}
                      />
                    )}
                    <span className="text-md">{option.title}</span>

                    {selected ? (
                      <span className="inset-y-0 ml-auto flex items-center pl-3">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </StyledListboxOption>
            ))}
          </StyledListboxOptions>
        </Transition>
      </div>
    </StyledListbox>
  );
}

export default ModelSelectionListbox;
