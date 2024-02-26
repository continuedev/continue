import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Fragment, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { postToIde } from "../../util/ide";
import HeaderButtonWithText from "../HeaderButtonWithText";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

const StyledPlusIcon = styled(PlusIcon)`
  background-color: ${vscBackground};
  cursor: pointer;
  margin: 0px;
  padding-left: 4px;
  padding-right: 4px;
  height: 100%;

  &:hover {
    background-color: ${vscInputBackground};
  }
  border-left: 0.5px solid ${lightGray};
`;

const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
  padding: 0;
  min-width: 80px;
`;

const StyledListboxButton = styled(Listbox.Button)`
  position: relative;
  cursor: pointer;
  background-color: ${vscBackground};
  text-align: left;
  border: none;
  margin: 0;
  height: 100%;
  width: 100%;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  color: ${vscForeground};

  padding: 4px 8px;

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

  position: absolute;
  bottom: calc(100% - 16px);
  max-width: 100%;
  max-height: 80vh;

  border-radius: ${defaultBorderRadius};
  overflow-y: scroll;
`;

const StyledListboxOption = styled(Listbox.Option)<{ selected: boolean }>`
  background-color: ${({ selected }) =>
    selected ? vscListActiveBackground : vscInputBackground};
  cursor: pointer;
  padding: 6px 8px;

  &:hover {
    background-color: ${vscListActiveBackground};
    color: ${vscListActiveForeground};
  }
`;

function ListBoxOption({
  option,
  idx,
  showDelete,
}: {
  option: Option;
  idx: number;
  showDelete?: boolean;
}) {
  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(false);

  return (
    <StyledListboxOption
      key={idx}
      selected={
        option.value ===
        JSON.stringify({
          t: "default",
          idx: -1,
        })
      }
      value={option.value}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div className="flex items-center justify-between gap-3 h-5 relative">
        <span>{option.title}</span>
        {hovered && showDelete && (
          <HeaderButtonWithText
            text="Delete"
            onClick={(e) => {
              dispatch(setShowDialog(true));
              dispatch(
                setDialogMessage(
                  <ConfirmationDialog
                    text={`Are you sure you want to delete this model? (${option.title})`}
                    onConfirm={() => {
                      postToIde("config/deleteModel", { title: option.title });
                    }}
                  />
                )
              );
              e.stopPropagation();
              e.preventDefault();
            }}
            style={{ backgroundColor: vscInputBackground }}
            className="absolute right-0 p-1"
          >
            <TrashIcon width="1.2em" height="1.2em" />
          </HeaderButtonWithText>
        )}
      </div>
    </StyledListboxOption>
  );
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

interface Option {
  value: string;
  title: string;
}

function ModelSelect(props: {}) {
  const dispatch = useDispatch();
  const defaultModel = useSelector(defaultModelSelector);
  const allModels = useSelector(
    (state: RootState) => state.state.config.models
  );

  const navigate = useNavigate();

  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    setOptions(
      allModels.map((model) => {
        return {
          value: model.title,
          title: modelSelectTitle(model),
        };
      })
    );
  }, [allModels]);

  const topDiv = document.getElementById("model-select-top-div");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "'" && isMetaEquivalentKeyPressed(event)) {
        const direction = event.shiftKey ? -1 : 1;
        const currentIndex = options.findIndex(
          (option) => option.value === defaultModel?.title
        );
        let nextIndex = (currentIndex + 1 * direction) % options.length;
        if (nextIndex < 0) nextIndex = options.length - 1;
        dispatch(setDefaultModel(options[nextIndex].value));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [options, defaultModel]);

  return (
    <>
      <GridDiv>
        <StyledListbox
          value={"GPT-4"}
          onChange={(val: string) => {
            if (val === defaultModel?.title) return;
            dispatch(setDefaultModel(val));
            // TODO
            // client?.setModelForRoleFromTitle("default", val);
          }}
          defaultValue={"GPT-4"}
        >
          <div className="relative">
            <StyledListboxButton>
              <div>{modelSelectTitle(defaultModel)}</div>
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </StyledListboxButton>
            {topDiv &&
              ReactDOM.createPortal(
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <StyledListboxOptions>
                    {options.map((option, idx) => (
                      <ListBoxOption
                        option={option}
                        idx={idx}
                        key={idx}
                        showDelete={options.length > 1}
                      />
                    ))}
                    <i className="text-xs ml-2" style={{ color: lightGray }}>
                      {getMetaKeyLabel()}' to toggle
                    </i>
                  </StyledListboxOptions>
                </Transition>,
                topDiv
              )}
          </div>
        </StyledListbox>

        <StyledPlusIcon
          width="1.3em"
          height="1.3em"
          onClick={() => {
            navigate("/models");
          }}
        />
      </GridDiv>
    </>
  );
}

export default ModelSelect;
