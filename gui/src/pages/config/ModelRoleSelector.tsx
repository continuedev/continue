import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { type ModelDescription } from "core";
import { Fragment } from "react";
import { ToolTip } from "../../components/gui/Tooltip";

/**
 * A component for selecting a model for a specific role
 */
interface ModelRoleSelectorProps {
  models: ModelDescription[];
  selectedModel: ModelDescription | null;
  onSelect: (model: ModelDescription | null) => void;
  displayName: string;
  description: string;
}

const ModelRoleSelector = ({
  models,
  selectedModel,
  onSelect,
  displayName,
  description,
}: ModelRoleSelectorProps) => {
  function handleSelect(title: string | null) {
    onSelect(models.find((m) => m.title === title) ?? null);
  }

  return (
    <>
      <div className="mt-2 flex flex-row items-center gap-1 sm:mt-0">
        <span className="text-sm">{displayName}</span>
        <InformationCircleIcon
          className="h-3 w-3"
          data-tooltip-id={`${displayName}-description`}
        />
        <ToolTip id={`${displayName}-description`} place={"bottom"}>
          {description}
        </ToolTip>
      </div>

      {models.length === 0 ? (
        <span className="text-lightgray">
          {["Chat", "Apply", "Edit"].includes(displayName)
            ? "None (defaulting to Chat model)"
            : "None"}
        </span>
      ) : (
        <Listbox value={selectedModel?.title ?? null} onChange={handleSelect}>
          {({ open }) => (
            <div className="relative">
              <Listbox.Button className="border-vsc-input-border bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground relative m-0 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-2 py-1 text-left">
                <span className="lines lines-1">
                  {selectedModel?.title ?? `Select ${displayName} model`}
                </span>
                <div className="pointer-events-none flex items-center">
                  <ChevronUpDownIcon
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </div>
              </Listbox.Button>

              <Transition
                as={Fragment}
                show={open}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Listbox.Options className="bg-vsc-background max-h-80vh absolute z-[800] mt-0.5 w-full overflow-y-scroll rounded-sm p-0">
                  {models.map((option, idx) => (
                    <Listbox.Option
                      key={idx}
                      value={option.title}
                      className={`text-vsc-foreground hover:text-list-active-foreground flex cursor-pointer flex-row items-center gap-3 px-2 py-1 ${option?.title === selectedModel?.title ? "bg-list-active" : "bg-vsc-input-background"}`}
                    >
                      <span className="lines lines-1 relative flex h-5 items-center justify-between gap-3 pr-2 text-xs">
                        {option.title}
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          )}
        </Listbox>
      )}
    </>
  );
};

export default ModelRoleSelector;
