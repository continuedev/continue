import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Dispatch, Fragment, SetStateAction } from "react";
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
import { DisplayInfo } from "../../../util/modelData";

const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
`;

const StyledListboxButton = styled(Listbox.Button)`
  cursor: pointer;
  background-color: ${vscBackground};
  text-align: left;
  border: 1px solid ${vscButtonBackground};
  margin: 0;
  height: 100%;
  width: 100%;

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

const StyledListboxOptions = styled(Listbox.Options)`
  background-color: ${vscInputBackground};
  padding: 0;

  border-radius: ${defaultBorderRadius};
  overflow-y: scroll;
  z-index: 10;
`;

const StyledListboxOption = styled(Listbox.Option)<{ selected: boolean }>`
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

interface QuickSetupListBoxProps {
  selectedProvider: DisplayInfo;
  setSelectedProvider: Dispatch<SetStateAction<DisplayInfo>>;
  options: DisplayInfo[];
}

function QuickSetupListBox({
  selectedProvider,
  setSelectedProvider,
  options,
}: QuickSetupListBoxProps) {
  return (
    <StyledListbox value={selectedProvider} onChange={setSelectedProvider}>
      <div className="relative mt-1">
        <StyledListboxButton className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none sm:text-sm">
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
          <StyledListboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg focus:outline-none sm:text-sm">
            {options.map((option, index) => (
              <StyledListboxOption
                selected={selectedProvider.title === option.title}
                key={index}
                className={({ active }) =>
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
                      <span className="inset-y-0 ml-auto flex items-center pl-3 text-amber-600">
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

export default QuickSetupListBox;
