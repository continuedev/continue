import { Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Dispatch, Fragment, SetStateAction } from "react";

import {
  StyledListbox,
  StyledListboxButton,
  StyledListboxOption,
  StyledListboxOptions,
} from "./StyledListbox";

interface DisplayInfo {
  title: string;
  icon?: string;
}

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
