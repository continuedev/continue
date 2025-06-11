import {
  CheckIcon,
  ChevronUpDownIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Fragment } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../components/ui";
import { DisplayInfo } from "../../pages/AddNewModel/configs/models";

interface ModelSelectionListboxProps {
  /** Model selection listbox for choosing AI providers */
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
    <Listbox value={selectedProvider} onChange={setSelectedProvider}>
      <div className="relative mb-2 mt-1">
        <ListboxButton className="bg-background border-border text-foreground hover:bg-input relative m-0 grid h-full w-full cursor-pointer grid-cols-[1fr_auto] items-center rounded-lg border border-solid py-2 pl-3 pr-10 text-left focus:outline-none">
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
              className="text-description-muted h-5 w-5"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions className="bg-input rounded-default absolute left-0 top-full z-10 mt-1 h-fit w-3/5 overflow-y-auto p-0 focus:outline-none [&]:!max-h-[30vh]">
            {topOptions.length > 0 && (
              <div className="py-1">
                <div className="text-description-muted px-3 py-1 text-xs font-medium uppercase tracking-wider">
                  Popular
                </div>
                {topOptions.map((option, index) => (
                  <ListboxOption
                    key={index}
                    className={({ selected }: { selected: boolean }) =>
                      ` ${selected ? "bg-list-active" : "bg-input"} hover:bg-list-active hover:text-list-active-foreground relative flex cursor-default cursor-pointer select-none items-center justify-between gap-2 p-1.5 px-3 py-2 pr-4`
                    }
                    value={option}
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex items-center">
                          {option.title === "Autodetect" ? (
                            <CubeIcon className="mr-2 h-4 w-4" />
                          ) : (
                            window.vscMediaUrl &&
                            option.icon && (
                              <img
                                src={`${window.vscMediaUrl}/logos/${option.icon}`}
                                className="mr-2 h-4 w-4 object-contain object-center"
                              />
                            )
                          )}
                          <span className="text-xs">{option.title}</span>
                        </div>
                        {selected && (
                          <CheckIcon className="h-3 w-3" aria-hidden="true" />
                        )}
                      </>
                    )}
                  </ListboxOption>
                ))}
              </div>
            )}
            {topOptions.length > 0 && otherOptions.length > 0 && (
              <div className="bg-border my-1 h-px min-h-px" />
            )}
            {otherOptions.length > 0 && (
              <div className="py-1">
                <div className="text-description-muted px-3 py-1 text-xs font-medium uppercase tracking-wider">
                  Additional providers
                </div>
                {otherOptions.map((option, index) => (
                  <ListboxOption
                    key={index}
                    className={({ selected }: { selected: boolean }) =>
                      ` ${selected ? "bg-list-active" : "bg-input"} hover:bg-list-active hover:text-list-active-foreground relative flex cursor-default cursor-pointer select-none items-center justify-between gap-2 p-1.5 px-3 py-2 pr-4`
                    }
                    value={option}
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex items-center">
                          {option.title === "Autodetect" ? (
                            <CubeIcon className="mr-2 h-4 w-4" />
                          ) : (
                            window.vscMediaUrl &&
                            option.icon && (
                              <img
                                src={`${window.vscMediaUrl}/logos/${option.icon}`}
                                className="mr-2 h-4 w-4 object-contain object-center"
                              />
                            )
                          )}
                          <span className="text-xs">{option.title}</span>
                        </div>

                        {selected && (
                          <CheckIcon className="h-3 w-3" aria-hidden="true" />
                        )}
                      </>
                    )}
                  </ListboxOption>
                ))}
              </div>
            )}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

export default ModelSelectionListbox;
