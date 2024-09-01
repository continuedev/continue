import { Listbox } from "@headlessui/react";
import {
  ChevronDownIcon,
  CubeIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef, useState } from "react";
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

const StyledListboxOptions = styled(Listbox.Options)<{ showAbove: boolean }>`
  margin-top: 4px;
  position: absolute;
  list-style: none;
  padding: 4px;
  white-space: nowrap;
  cursor: default;

  display: flex;
  flex-direction: column;

  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${lightGray};
  background-color: ${vscInputBackground};

  max-height: ${MAX_HEIGHT_PX}px;
  overflow-y: auto;

  ${(props) => (props.showAbove ? "bottom: 100%;" : "top: 100%;")}
`;

const StyledListboxOption = styled(Listbox.Option)`
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding: 6px;

  &:hover {
    background: ${(props) => `${lightGray}33`};
  }
`;

const StyledTrashIcon = styled(TrashIcon)`
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 8px;
  &:hover {
    color: red;
  }
`;

const Divider = styled.div`
  height: 1px;
  background-color: ${lightGray};
  margin: 4px;
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
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center pr-4">
          <CubeIcon className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{option.title}</span>
        </div>

        <StyledTrashIcon
          style={{ visibility: hovered && showDelete ? "visible" : "hidden" }}
          className="ml-auto"
          width="1.2em"
          height="1.2em"
          onClick={onClickDelete}
        />
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

function ModelSelect() {
  const dispatch = useDispatch();
  const defaultModel = useSelector(defaultModelSelector);
  const allModels = useSelector(
    (state: RootState) => state.state.config.models,
  );

  const navigate = useNavigate();

  const [options, setOptions] = useState<Option[]>([]);

  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId,
  );

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

  const ideMessenger = useContext(IdeMessengerContext);

  const [showAbove, setShowAbove] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = MAX_HEIGHT_PX;

      setShowAbove(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
  };

  useEffect(() => {
    const handleResize = () => calculatePosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
          <span className="hover:underline">
            {modelSelectTitle(defaultModel) || "Select model"}{" "}
            <ChevronDownIcon className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
        </StyledListboxButton>
        <StyledListboxOptions showAbove={showAbove}>
          <div className={`max-h-[${MAX_HEIGHT_PX}px] overflow-y-auto`}>
            {options.map((option, idx) => (
              <ModelOption
                option={option}
                idx={idx}
                key={idx}
                showDelete={options.length > 1}
              />
            ))}
          </div>

          <div className="mt-auto">
            {selectedProfileId === "local" && (
              <>
                {options.length > 0 && <Divider />}

                <StyledListboxOption
                  key={options.length}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    navigate("/addModel");
                  }}
                  value={"addModel" as any}
                >
                  <div className="flex items-center">
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Model
                  </div>
                </StyledListboxOption>
              </>
            )}

            <Divider />

            <i
              style={{
                color: lightGray,
                padding: "4px",
                marginTop: "4px",
                display: "block",
              }}
            >
              {getMetaKeyLabel()}' to toggle
            </i>
          </div>
        </StyledListboxOptions>
      </div>
    </Listbox>
  );
}

export default ModelSelect;
