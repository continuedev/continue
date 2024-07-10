import { Listbox } from "@headlessui/react";
import { ChevronDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscInputBackground } from "..";
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

const StyledListboxButton = styled(Listbox.Button)`
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  cursor: pointer;
  font-size: ${(props) => `${getFontSize() - 4}px`};
  background: transparent;
  color: ${(props) => lightGray};
  &:focus {
    outline: none;
  }
`;

const StyledListboxOptions = styled(Listbox.Options)`
  margin-top: 4px;
  position: absolute;
  list-style: none;
  padding: 4px;
  white-space: nowrap;
  cursor: default;

  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${vscInputBackground};
`;

const StyledListboxOption = styled(Listbox.Option)`
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding-left: 4px;
  padding-right: 4px;
  padding-top: 4px;
  padding-bottom: 4px;

  &:hover {
    background: ${(props) => `${lightGray}33`};
  }
`;

const StyledTrashIcon = styled(TrashIcon)`
  position: absolute;
  padding: 4px;
  right: 0;
  background: ${vscInputBackground};
  border-radius: ${defaultBorderRadius};

  &:hover {
    color: red;
  }
`;

function ModelOption({
  option,
  idx,
  showDelete,
}: {
  option: Option;
  idx: number;
  showDelete?: boolean;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(false);

  return (
    <StyledListboxOption
      key={idx}
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
          <StyledTrashIcon
            width="1.2em"
            height="1.2em"
            onClick={(e) => {
              dispatch(setShowDialog(true));
              dispatch(
                setDialogMessage(
                  <ConfirmationDialog
                    text={`Are you sure you want to delete this model? (${option.title})`}
                    onConfirm={() => {
                      ideMessenger.post("config/deleteModel", {
                        title: option.title,
                      });
                    }}
                  />,
                ),
              );
              e.stopPropagation();
              e.preventDefault();
            }}
          />
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
    (state: RootState) => state.state.config.models,
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
      }),
    );
  }, [allModels]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "'" && isMetaEquivalentKeyPressed(event)) {
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

  return (
    <Listbox
      onChange={(val: string) => {
        if (val === defaultModel?.title) return;
        dispatch(setDefaultModel({ title: val }));
      }}
    >
      <div className="relative">
        <StyledListboxButton className="h-[18px] overflow-hidden">
          <div>{modelSelectTitle(defaultModel) || "Select model"}</div>
          <div className="pointer-events-none flex items-center">
            <ChevronDownIcon
              className="h-2.5 w-2.5 text-gray-400"
              aria-hidden="true"
            />
          </div>
        </StyledListboxButton>
        <StyledListboxOptions>
          {options.map((option, idx) => (
            <ModelOption
              option={option}
              idx={idx}
              key={idx}
              showDelete={options.length > 1}
            />
          ))}
          <StyledListboxOption
            key={options.length}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              navigate("/addModel");
            }}
            value={"addModel" as any}
            className="font-bold"
          >
            + Add Model
          </StyledListboxOption>

          <i style={{ color: lightGray, padding: "4px", marginTop: "4px" }}>
            {getMetaKeyLabel()}' to toggle
          </i>
        </StyledListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModelSelect;
