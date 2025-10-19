import {
  ArrowPathIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CubeIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { AddModelForm } from "../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../redux/thunks/updateSelectedModelByRole";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { CONFIG_ROUTES } from "../../util/navigation";
import {
  Button,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  useFontSize,
} from "../ui";
import { Divider } from "../ui/Divider";

interface ModelOptionProps {
  option: Option;
  idx: number;
  showMissingApiKeyMsg: boolean;
  isSelected?: boolean;
}

interface Option {
  value: string;
  title: string;
  apiKey?: string;
  sourceFile?: string;
  isAutoDetected?: boolean;
}

function modelSelectTitle(model: any): string {
  if (model?.title) return model?.title;
  if (model?.model !== undefined && model?.model.trim() !== "") {
    if (model?.class_name) {
      return `${model?.class_name} - ${model?.model}`;
    }
    return model?.model;
  }
  return model?.class_name;
}

/**makeshift way to close the headlessui listbox due to absence of open state on the listbox */
function closeDropDown(button: HTMLButtonElement | null) {
  if (!button) return;
  button.classList.add("hidden");
  setTimeout(() => {
    button.classList.remove("hidden");
  });
}

function ModelOption({
  option,
  idx,
  showMissingApiKeyMsg,
  isSelected,
}: ModelOptionProps) {
  const navigate = useNavigate();

  function handleOptionClick(e: any) {
    if (showMissingApiKeyMsg) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleConfigureClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(CONFIG_ROUTES.MODELS);
  }

  return (
    <ListboxOption
      key={idx}
      disabled={showMissingApiKeyMsg}
      value={option.value}
      onClick={handleOptionClick}
      className={`group ${isSelected ? "bg-list-active text-list-active-foreground" : ""}`}
    >
      <div className="flex w-full items-center justify-between gap-5">
        <div className="flex items-center gap-2 py-0.5">
          <CubeIcon className="h-3 w-3 flex-shrink-0" />
          <span className="line-clamp-1">
            {option.title}
            {option.isAutoDetected && (
              <span className="text-description-muted ml-1.5 text-[10px] italic">
                (autodetected)
              </span>
            )}
            {showMissingApiKeyMsg && (
              <span className="ml-1.5 text-[10px] italic">
                (Missing API key)
              </span>
            )}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-description-muted hover:enabled:text-foreground my-0 h-4 w-4 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleConfigureClick}
        >
          <Cog6ToothIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ListboxOption>
  );
}

function ModelSelect() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const config = useAppSelector((state) => state.config.config);
  const isConfigLoading = useAppSelector((state) => state.config.loading);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [sortedOptions, setSortedOptions] = useState<Option[]>([]);
  const { selectedProfile } = useAuth();
  const tinyFont = useFontSize(-4);

  let selectedModel = null;
  let allModels = null;
  if (isInEdit) {
    allModels = config.modelsByRole.edit;
    selectedModel = config.selectedModelByRole.edit;
  }
  if (!selectedModel) {
    selectedModel = config.selectedModelByRole.chat;
  }
  if (!allModels || allModels.length === 0) {
    allModels = config.modelsByRole.chat;
  }

  // Sort so that options without an API key are at the end
  useEffect(() => {
    const alphaSort = options.sort((a, b) => a.title.localeCompare(b.title));
    const enabledOptions = alphaSort.filter((option) => option.apiKey !== "");
    const disabledOptions = alphaSort.filter((option) => option.apiKey === "");

    const sorted = [...enabledOptions, ...disabledOptions];

    setSortedOptions(sorted);
  }, [options]);

  useEffect(() => {
    setOptions(
      allModels.map((model) => {
        return {
          value: model.title,
          title: modelSelectTitle(model),
          apiKey: model.apiKey,
          sourceFile: model.sourceFile,
          isAutoDetected: model.isFromAutoDetect,
        };
      }),
    );
  }, [allModels]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "'" &&
        isMetaEquivalentKeyPressed(event as any) &&
        !event.shiftKey // To prevent collisions w/ assistant toggle logic
      ) {
        if (!selectedProfile) {
          return;
        }

        const direction = event.shiftKey ? -1 : 1;
        const currentIndex = options.findIndex(
          (option) => option.value === selectedModel?.title,
        );
        let nextIndex = (currentIndex + 1 * direction) % options.length;
        if (nextIndex < 0) nextIndex = options.length - 1;
        const newModelTitle = options[nextIndex].value;

        void dispatch(
          updateSelectedModelByRole({
            selectedProfile,
            role: "chat",
            modelTitle: newModelTitle,
          }),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [options, selectedModel]);

  function onClickAddModel(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    closeDropDown(buttonRef.current);

    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  function onClickConfigureModels(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    closeDropDown(buttonRef.current);

    navigate(CONFIG_ROUTES.MODELS);
  }

  const hasNoModels = allModels?.length === 0;

  return (
    <Listbox
      onChange={async (val: string) => {
        if (val === selectedModel?.title) return;
        void dispatch(
          updateSelectedModelByRole({
            selectedProfile,
            role: isInEdit ? "edit" : "chat",
            modelTitle: val,
          }),
        );
      }}
    >
      <div className="relative flex">
        <ListboxButton
          data-testid="model-select-button"
          ref={buttonRef}
          className="text-description h-[18px] gap-1 border-none"
        >
          <span className="line-clamp-1 break-all hover:brightness-110">
            {modelSelectTitle(selectedModel) || "Select model"}
          </span>
          <ChevronDownIcon
            className="hidden h-2 w-2 flex-shrink-0 hover:brightness-110 min-[200px]:flex"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-[160px]">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="text-description text-xs font-medium">Models</span>
            <div className="flex items-center gap-0.5">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onClickConfigureModels(e);
                }}
                variant="ghost"
                size="sm"
                className="my-0 h-5 w-5 p-0"
              >
                <Cog6ToothIcon className="text-description h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="no-scrollbar max-h-[300px] overflow-y-auto">
            {isConfigLoading ? (
              <div className="text-description flex items-center gap-2 px-2 pb-2 pt-1 text-xs">
                <ArrowPathIcon className="animate-spin-slow h-3 w-3" />
                <span>Loading config</span>
              </div>
            ) : hasNoModels ? (
              <div className="text-description-muted px-2 py-4 text-center text-sm">
                No models configured
              </div>
            ) : (
              sortedOptions.map((option, idx) => (
                <ModelOption
                  option={option}
                  idx={idx}
                  key={idx}
                  showMissingApiKeyMsg={option.apiKey === ""}
                  isSelected={option.value === selectedModel?.title}
                />
              ))
            )}
          </div>

          {!isConfigLoading && (
            <>
              {selectedProfile?.profileType === "local" && (
                <>
                  <Divider className="!mb-0" />
                  <ListboxOption
                    key={options.length}
                    onClick={onClickAddModel}
                    value={"addModel" as any}
                    fontSizeModifier={-2}
                    className="px-2 py-2"
                  >
                    <span className="text-description text-2xs flex flex-row items-center">
                      <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                      Add Chat model
                    </span>
                  </ListboxOption>
                </>
              )}

              <Divider className="!my-0" />
              <div className="text-description flex items-center justify-start p-2">
                <span className="block" style={{ fontSize: tinyFont }}>
                  <code>{getMetaKeyLabel()}'</code> to toggle model
                </span>
              </div>
            </>
          )}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModelSelect;
