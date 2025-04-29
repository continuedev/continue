import {
  CheckIcon,
  ChevronUpDownIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Fragment } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from "..";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../components/ui";
import { DisplayInfo } from "../../pages/AddNewModel/configs/models";
export const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
`;

export const StyledListboxButton = styled(ListboxButton)`
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

export const StyledListboxOptions = styled(ListboxOptions)`
  background-color: ${vscInputBackground};
  padding: 0;

  position: absolute;
  top: 100%;
  left: 0;

  margin-top: 0.25rem;

  height: fit-content;
  max-height: 15rem;
  width: 60%;

  border-radius: ${defaultBorderRadius};
  overflow-y: auto;
  z-index: 10;

  &:focus {
    outline: none;
  }
`;
export const StyledListboxOption = styled(ListboxOption)<{
  selected: boolean;
}>`
  background-color: ${({ selected }) =>
    selected ? vscListActiveBackground : vscInputBackground};
  cursor: pointer;
  padding: 6px 8px 6px 12px;

  display: flex;
  gap: 8px;
  align-items: center;

  &:hover {
    background-color: ${vscListActiveBackground};
    color: ${vscListActiveForeground};
  }
`;

interface ModelSelectionListboxProps {
  selectedProvider: DisplayInfo;
  setSelectedProvider: (val: DisplayInfo) => void;
  topOptions?: DisplayInfo[];
  otherOptions?: DisplayInfo[];
}

function ModelSelectionListbox({
  selectedProvider,
  setSelectedProvider,
  topOptions = [],
  otherOptions = [],
}: ModelSelectionListboxProps) {
  return (
    <StyledListbox value={selectedProvider} onChange={setSelectedProvider}>
      <div className="relative mb-2 mt-1">
        <StyledListboxButton>
          <span className="flex items-center">
            {window.vscMediaUrl && selectedProvider.icon && (
              <img
                src={`${window.vscMediaUrl}/logos/${selectedProvider.icon}`}
                className="mr-3 h-4 w-4 object-contain object-center"
              />
            )}
            <span className="text-xs">{selectedProvider.title}</span>
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
            {topOptions.length > 0 && (
              <div className="py-1">
                {topOptions.map((option, index) => (
                  <StyledListboxOption
                    selected={selectedProvider.title === option.title}
                    key={index}
                    className="relative cursor-default select-none py-2 pr-4 text-gray-400"
                    value={option}
                  >
                    {({ selected }) => (
                      <>
                        {option.title === "Autodetect" ? (
                          <CubeIcon className="mr-2 h-4 w-4 text-gray-400" />
                        ) : (
                          window.vscMediaUrl &&
                          option.icon && (
                            <img
                              src={`${window.vscMediaUrl}/logos/${option.icon}`}
                              className="mr-1 h-4 w-4 object-contain object-center"
                            />
                          )
                        )}
                        <span className="text-xs">{option.title}</span>

                        {selected && (
                          <span className="inset-y-0 ml-auto flex items-center pl-3">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </StyledListboxOption>
                ))}
              </div>
            )}

            {topOptions.length > 0 && otherOptions.length > 0 && (
              <div className="my-1 h-px bg-zinc-500" />
            )}

            {otherOptions.length > 0 && (
              <div className="py-1">
                {otherOptions.map((option, index) => (
                  <StyledListboxOption
                    selected={selectedProvider.title === option.title}
                    key={index}
                    className="relative cursor-default select-none py-2 pr-4 text-gray-400"
                    value={option}
                  >
                    {({ selected }) => (
                      <>
                        {option.title === "Autodetect" ? (
                          <CubeIcon className="mr-2 h-4 w-4 text-gray-400" />
                        ) : (
                          window.vscMediaUrl &&
                          option.icon && (
                            <img
                              src={`${window.vscMediaUrl}/logos/${option.icon}`}
                              className="mr-1 h-4 w-4 object-contain object-center"
                            />
                          )
                        )}
                        <span className="text-xs">{option.title}</span>

                        {selected && (
                          <span className="inset-y-0 ml-auto flex items-center pl-3">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </StyledListboxOption>
                ))}
              </div>
            )}
          </StyledListboxOptions>
        </Transition>
      </div>
    </StyledListbox>
  );
}

export default ModelSelectionListbox;
