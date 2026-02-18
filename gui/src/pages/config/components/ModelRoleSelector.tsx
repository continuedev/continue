import {
  CheckIcon,
  ChevronUpDownIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import { LLMConfigurationStatuses } from "core/llm/constants";
import { MouseEvent, ReactNode, useContext } from "react";
import { defaultBorderRadius } from "../../../components";
import InfoHover from "../../../components/InfoHover";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { fontSize } from "../../../util";

interface ModelRoleSelectorProps {
  models: ModelDescription[];
  selectedModel: ModelDescription | null;
  onSelect: (model: ModelDescription | null) => void;
  displayName: string;
  description: string | ReactNode;
  setupURL: string;
  hideTitle?: boolean;
}

const ModelRoleSelector = ({
  models,
  selectedModel,
  onSelect,
  displayName,
  description,
  setupURL,
  hideTitle = false,
}: ModelRoleSelectorProps) => {
  const ideMessenger = useContext(IdeMessengerContext);

  const noConfiguredModels = models.every(
    (model) => model.configurationStatus !== LLMConfigurationStatuses.VALID,
  );

  function handleSelect(title: string | null) {
    onSelect(models.find((m) => m.title === title) ?? null);
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
      {!hideTitle && (
        <div className="mt-2 flex flex-row items-center gap-1 sm:mt-0">
          <span style={{ fontSize: fontSize(-1) }}>{displayName}</span>
          <InfoHover size="3" id={displayName} msg={description} />
        </div>
      )}

      <Listbox value={selectedModel?.title ?? null} onChange={handleSelect}>
        <div className="relative">
          {models.length === 0 ? (
            <ListboxButton
              onClick={() => ideMessenger.post("openUrl", setupURL)}
              className="bg-input border-command-border hover:bg-list-active hover:text-list-active-foreground text-description w-full justify-between rounded border px-2 py-1.5 underline hover:underline"
            >
              <span className="line-clamp-1" style={{ fontSize: fontSize(-1) }}>
                Setup {displayName} model
              </span>
            </ListboxButton>
          ) : (
            <>
              <ListboxButton
                disabled={models.length === 0}
                className="bg-input border-command-border hover:bg-list-active hover:text-list-active-foreground w-full justify-between rounded border px-2 py-1.5"
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
                  <span
                    className="line-clamp-1"
                    style={{ fontSize: fontSize(-1) }}
                  >
                    {selectedModel?.title ?? `Select ${displayName} model`}
                  </span>
                )}

                {models.length > 0 && (
                  <div className="pointer-events-none flex items-center">
                    <ChevronUpDownIcon className="h-3 w-3" aria-hidden="true" />
                  </div>
                )}
              </ListboxButton>
              <Transition>
                <ListboxOptions
                  style={{ borderRadius: defaultBorderRadius }}
                  className="min-w-40"
                >
                  {[...models]
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((option, idx) => {
                      const isConfigInvalid =
                        option.configurationStatus !==
                        LLMConfigurationStatuses.VALID;
                      let invalidMessage = "(Invalid config)";
                      if (
                        option.configurationStatus ===
                        LLMConfigurationStatuses.MISSING_ENV_SECRET
                      ) {
                        invalidMessage = "(Missing env secret)";
                      }
                      if (
                        option.configurationStatus ===
                        LLMConfigurationStatuses.MISSING_API_KEY
                      ) {
                        invalidMessage = "(Missing API Key)";
                      }

                      return (
                        <ListboxOption
                          key={idx}
                          value={option.title}
                          disabled={isConfigInvalid}
                          onClick={(e: any) =>
                            handleOptionClick(isConfigInvalid, e)
                          }
                          className=""
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <CubeIcon className="h-3 w-3 flex-shrink-0" />
                              <span
                                className="line-clamp-1 truncate"
                                style={{ fontSize: fontSize(-1) }}
                              >
                                {option.title}
                                {isConfigInvalid && (
                                  <span className="ml-2 text-[10px] italic">
                                    {invalidMessage}
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex-shrink-0">
                              {option.title === selectedModel?.title && (
                                <CheckIcon className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </ListboxOption>
                      );
                    })}
                </ListboxOptions>
              </Transition>
            </>
          )}
        </div>
      </Listbox>
    </>
  );
};

export default ModelRoleSelector;
