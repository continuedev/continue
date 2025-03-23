import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { type ModelDescription } from "core";
import { Fragment } from "react";
import { defaultBorderRadius } from "../../components";
import { ToolTip } from "../../components/gui/Tooltip";
import InfoHover from "../../components/InfoHover";
import { fontSize } from "../../util";

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
        <span
          style={{
            fontSize: fontSize(-3),
          }}
        >
          {displayName}
        </span>
        <InfoHover size="3" id={displayName} msg={description} />
        <ToolTip id={`${displayName}-description`} place={"bottom"}>
          {description}
        </ToolTip>
      </div>
      <Listbox value={selectedModel?.title ?? null} onChange={handleSelect}>
        {({ open }) => (
          <div className="relative">
            <Listbox.Button
              aria-disabled={models.length === 0}
              className={`border-vsc-input-border bg-vsc-background ${models.length > 0 ? "hover:bg-vsc-input-background cursor-pointer" : "cursor-not-allowed opacity-50"} text-vsc-foreground relative m-0 flex w-full items-center justify-between rounded-md border border-solid px-1.5 py-0.5 text-left text-sm`}
            >
              {models.length === 0 ? (
                <span
                  className="text-lightgray lines lines-1 italic"
                  style={{ fontSize: fontSize(-3) }}
                >{`No ${displayName} models${["Chat", "Apply", "Edit"].includes(displayName) ? ". Using chat model" : ""}`}</span>
              ) : (
                <span
                  className="lines lines-1"
                  style={{ fontSize: fontSize(-3) }}
                >
                  {selectedModel?.title ?? `Select ${displayName} model`}
                </span>
              )}
              {models.length ? (
                <div className="pointer-events-none flex items-center">
                  <ChevronUpDownIcon className="h-3 w-3" aria-hidden="true" />
                </div>
              ) : null}
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
              <Listbox.Options
                style={{ borderRadius: defaultBorderRadius }}
                className="bg-vsc-input-background border-vsc-input-border fixed z-[800] mt-0.5 min-w-40 overflow-auto border border-solid p-0 shadow-lg"
              >
                {models.map((option, idx) => (
                  <Listbox.Option
                    key={idx}
                    value={option.title}
                    className={`text-vsc-foreground hover:bg-list-active hover:text-list-active-foreground flex cursor-pointer flex-row items-center justify-between px-1 py-0.5`}
                  >
                    <span
                      className="lines lines-1 relative flex h-4 items-center gap-2"
                      style={{ fontSize: fontSize(-3) }}
                    >
                      {option.title}
                    </span>
                    {option.title === selectedModel?.title && (
                      <CheckIcon className="h-3 w-3" aria-hidden="true" />
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        )}
      </Listbox>
    </>
  );
};

export default ModelRoleSelector;
