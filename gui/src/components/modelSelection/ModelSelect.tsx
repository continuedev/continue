import { Listbox } from "@headlessui/react";
import {
  ChevronDownIcon,
  Cog6ToothIcon,
  CubeIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  Divider,
  lightGray,
  vscInputBackground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import {
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import AddModelForm from "../../forms/AddModelForm";

interface ModelOptionProps {
  option: Option;
  idx: number;
  showMissingApiKeyMsg: boolean;
  showDelete?: boolean;
}

interface Option {
  value: string;
  title: string;
  apiKey: string;
}

const MAX_HEIGHT_PX = 300;

const StyledListboxButton = styled(Listbox.Button)`
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 2px;
  border: none;
  cursor: pointer;
  font-size: ${getFontSize() - 2}px;
  background: transparent;
  color: ${lightGray};
  &:focus {
    outline: none;
  }
`;

const StyledListboxOptions = styled(Listbox.Options)<{ $showabove: boolean }>`
  margin-top: 4px;
  position: absolute;
  list-style: none;
  padding: 0px;
  white-space: nowrap;
  cursor: default;

  display: flex;
  flex-direction: column;

  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${vscInputBackground};

  max-height: ${MAX_HEIGHT_PX}px;
  overflow-y: scroll;

  scrollbar-width: none;

  ${(props) => (props.$showabove ? "bottom: 100%;" : "top: 100%;")}
`;

const StyledListboxOption = styled(Listbox.Option)<{ isDisabled?: boolean }>`
  border-radius: ${defaultBorderRadius};
  padding: 6px 12px;

  ${({ isDisabled }) =>
    !isDisabled &&
    `
    cursor: pointer;

    &:hover {
      background: ${lightGray}33;
    }
  `}

  ${({ isDisabled }) =>
    isDisabled &&
    `
    opacity: 0.5;
  `}
`;

const IconBase = styled.div<{ hovered: boolean }>`
  width: 1.2em;
  height: 1.2em;
  cursor: pointer;
  padding: 4px;
  border-radius: ${defaultBorderRadius};
  opacity: ${(props) => (props.hovered ? 0.75 : 0)};
  visibility: ${(props) => (props.hovered ? "visible" : "hidden")};

  &:hover {
    opacity: 1;
    background-color: ${lightGray}33;
  }
`;

const StyledTrashIcon = styled(IconBase).attrs({ as: TrashIcon })``;
const StyledCog6ToothIcon = styled(IconBase).attrs({ as: Cog6ToothIcon })``;

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

function ModelOption({
  option,
  idx,
  showDelete,
  showMissingApiKeyMsg,
}: ModelOptionProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(false);

  function onClickDelete(e) {
    e.stopPropagation();
    e.preventDefault();

    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`Delete ${option.title}`}
          text={`Are you sure you want to remove ${option.title} from your configuration?`}
          onConfirm={() => {
            ideMessenger.post("config/deleteModel", {
              title: option.title,
            });
          }}
        />,
      ),
    );
  }

  function onClickGear(e) {
    e.stopPropagation();
    e.preventDefault();

    ideMessenger.post("openConfigJson", undefined);
  }

  function handleOptionClick(e) {
    if (showMissingApiKeyMsg) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <StyledListboxOption
      key={idx}
      value={option.value}
      isDisabled={showMissingApiKeyMsg}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleOptionClick}
    >
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-grow items-center">
            <CubeIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="flex-grow">
              {option.title}
              {showMissingApiKeyMsg && (
                <span className="ml-2 text-[10px] italic">
                  (Missing API key)
                </span>
              )}
            </span>
          </div>
          <div className="ml-5 flex items-center">
            <StyledCog6ToothIcon hovered={hovered} onClick={onClickGear} />
            {showDelete && (
              <StyledTrashIcon hovered={hovered} onClick={onClickDelete} />
            )}
          </div>
        </div>
      </div>
    </StyledListboxOption>
  );
}

function ModelSelect() {
  const dispatch = useDispatch();
  const defaultModel = useSelector(defaultModelSelector);
  const allModels = useSelector(
    (state: RootState) => state.state.config.models,
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const [showAbove, setShowAbove] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [sortedOptions, setSortedOptions] = useState<Option[]>([]);
  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId,
  );

  // Sort so that options without an API key are at the end
  useEffect(() => {
    const enabledOptions = options.filter((option) => option.apiKey !== "");
    const disabledOptions = options.filter((option) => option.apiKey === "");

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
        };
      }),
    );
  }, [allModels]);

  useEffect(() => {
    const handleResize = () => calculatePosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "'" && isMetaEquivalentKeyPressed(event as any)) {
        const direction = event.shiftKey ? -1 : 1;
        const currentIndex = options.findIndex(
          (option) => option.value === defaultModel?.title,
        );
        let nextIndex = (currentIndex + 1 * direction) % options.length;
        if (nextIndex < 0) nextIndex = options.length - 1;
        dispatch(setDefaultModel({ title: options[nextIndex].value }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [options, defaultModel]);

  function calculatePosition() {
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = MAX_HEIGHT_PX;

    setShowAbove(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  }

  function onClickAddModel(e) {
    e.stopPropagation();
    e.preventDefault();

    // Close the dropdown
    if (buttonRef.current) {
      buttonRef.current.click();
    }
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

  return (
    <Listbox
      onChange={async (val: string) => {
        if (val === defaultModel?.title) return;
        dispatch(setDefaultModel({ title: val }));
        await ideMessenger.request("update/modelChange", val);
      }}
    >
      <div className="relative">
        <StyledListboxButton
          ref={buttonRef}
          className="h-[18px] overflow-hidden"
          style={{ padding: 0 }}
          onClick={calculatePosition}
        >
          <div className="flex max-w-[33vw] items-center gap-0.5 text-gray-400 transition-colors duration-200">
            <span className="truncate">
              {modelSelectTitle(defaultModel) || "Select model"}{" "}
            </span>
            <ChevronDownIcon
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />
          </div>
        </StyledListboxButton>
        <StyledListboxOptions
          $showabove={showAbove}
          className="z-50 max-w-[90vw]"
        >
          <div className={`max-h-[${MAX_HEIGHT_PX}px]`}>
            {sortedOptions.map((option, idx) => (
              <ModelOption
                option={option}
                idx={idx}
                key={idx}
                showDelete={options.length > 1}
                showMissingApiKeyMsg={option.apiKey === ""}
              />
            ))}
          </div>

          <div className="mt-auto">
            {selectedProfileId === "local" && (
              <>
                <StyledListboxOption
                  key={options.length}
                  onClick={onClickAddModel}
                  value={"addModel" as any}
                >
                  <div className="flex items-center py-0.5">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Chat model
                  </div>
                </StyledListboxOption>
              </>
            )}

            <Divider className="!my-0" />

            <span className="block px-3 py-3" style={{ color: lightGray }}>
              <code>{getMetaKeyLabel()} + '</code> to toggle
            </span>
          </div>
        </StyledListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModelSelect;
