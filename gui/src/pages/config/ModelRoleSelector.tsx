import {
  CheckIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import { LLMConfigurationStatuses } from "core/llm/constants";
import { MouseEvent, useContext, useState } from "react";
import { defaultBorderRadius } from "../../components";
import { ToolTip } from "../../components/gui/Tooltip";
import InfoHover from "../../components/InfoHover";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../components/ui";
import { IdeMessengerContext } from "../../context/IdeMessenger";
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
  const ideMessenger = useContext(IdeMessengerContext);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const noConfiguredModels = models.every(
    (model) => model.configurationStatus !== LLMConfigurationStatuses.VALID,
  );

  function handleSelect(title: string | null) {
    onSelect(models.find((m) => m.title === title) ?? null);
  }

  function onClickGear(e: MouseEvent<SVGSVGElement>) {
    e.stopPropagation();
    e.preventDefault();
    ideMessenger.post("config/openProfile", { profileId: undefined });
  }

  function handleOptionClick(
    showMissingApiKeyMsg: boolean,
    e: MouseEvent<HTMLLIElement>,
  ) {
    if (showMissingApiKeyMsg) {
      e.preventDefault();
      e.stopPropagation();
    }
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
        <div className="relative">
          <ListboxButton
            disabled={models.length === 0}
            className={`bg-vsc-editor-background hover:bg-list-active hover:text-list-active-foreground w-full justify-between`}
          >
            {models.length === 0 || noConfiguredModels ? (
              <span className="text-lightgray line-clamp-1 italic">
                {`No ${models.length === 0 ? "" : "valid "}${displayName} models${
                  ["Chat", "Apply", "Edit"].includes(displayName)
                    ? ". Using Chat model"
                    : ""
                }`}
              </span>
            ) : (
              <span className="line-clamp-1">
                {selectedModel?.title ?? `Select ${displayName} model`}
              </span>
            )}
            {models.length ? (
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon className="h-3 w-3" aria-hidden="true" />
              </div>
            ) : null}
          </ListboxButton>

          <Transition>
            <ListboxOptions
              style={{ borderRadius: defaultBorderRadius }}
              className="min-w-40"
            >
              {models.map((option, idx) => {
                const showMissingApiKeyMsg =
                  option.configurationStatus ===
                  LLMConfigurationStatuses.MISSING_API_KEY;

                return (
                  <ListboxOption
                    key={idx}
                    value={option.title}
                    disabled={showMissingApiKeyMsg}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={(e: any) =>
                      handleOptionClick(showMissingApiKeyMsg, e)
                    }
                    className={""}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-1 flex-row items-center justify-between gap-2">
                        <div className="flex flex-1 flex-row items-center gap-2">
                          <CubeIcon className="h-3 w-3 flex-shrink-0" />
                          <span
                            className="line-clamp-1 flex-1"
                            style={{ fontSize: fontSize(-3) }}
                          >
                            {option.title}
                            {showMissingApiKeyMsg && (
                              <span className="ml-2 text-[10px] italic">
                                (Missing API key)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-shrink-0 flex-row items-center gap-1">
                          {hoveredIdx === idx && (
                            <Cog6ToothIcon
                              className="h-3 w-3 flex-shrink-0"
                              onClick={onClickGear}
                            />
                          )}
                          {option.title === selectedModel?.title && (
                            <CheckIcon className="h-3 w-3 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </ListboxOption>
                );
              })}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </>
  );
};

export default ModelRoleSelector;
