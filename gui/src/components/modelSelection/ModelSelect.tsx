import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from "..";
import React, { Fragment, useContext, useEffect, useState } from "react";
import { GUIClientContext } from "../../App";
import { RootStore } from "../../redux/store";
import { useSelector } from "react-redux";
import {
  ChevronUpDownIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Listbox, Transition } from "@headlessui/react";
import ReactDOM from "react-dom";
import HeaderButtonWithText from "../HeaderButtonWithText";
import { defaultModelSelector } from "../../redux/selectors/configSelectors";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

const Select = styled.select`
  border: none;
  max-width: 50vw;
  background-color: ${vscBackground};
  color: ${vscForeground};
  padding: 6px;
  max-height: 35vh;
  overflow: scroll;
  cursor: pointer;

  &:focus {
    outline: none;
  }
  &:hover {
    background-color: ${secondaryDark};
  }
`;

const StyledPlusIcon = styled(PlusIcon)`
  background-color: ${vscBackground};
  cursor: pointer;
  margin: 0px;
  padding-left: 4px;
  padding-right: 4px;
  height: 100%;

  &:hover {
    background-color: ${secondaryDark};
  }
  border-left: 0.5px solid ${lightGray};
`;

const NewProviderDiv = styled.div`
  cursor: pointer;
  padding: 8px;
  padding-left: 16px;
  padding-right: 16px;
  border-top: 0.5px solid ${lightGray};

  &:hover {
    background-color: ${secondaryDark};
  }
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
    background-color: ${secondaryDark};
  }
`;

const StyledListboxOptions = styled(Listbox.Options)`
  background-color: ${secondaryDark};
  padding: 0;

  position: absolute;
  bottom: calc(100% - 16px);
  max-width: 100%;

  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

const StyledListboxOption = styled(Listbox.Option)<{ selected: boolean }>`
  background-color: ${({ selected }) =>
    selected ? `${buttonColor}88` : secondaryDark};
  cursor: pointer;
  padding: 6px 8px;

  &:hover {
    background-color: ${buttonColor}44;
  }
`;

function ListBoxOption({ option, idx }: { option: Option; idx: number }) {
  const client = useContext(GUIClientContext);
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
        {hovered && (
          <HeaderButtonWithText
            text="Delete"
            onClick={(e) => {
              client?.deleteModelAtIndex(idx - 1); // -1 because 0 is default, not in saved array
              e.stopPropagation();
              e.preventDefault();
            }}
            style={{ backgroundColor: secondaryDark }}
            className="absolute right-0 p-1"
          >
            <TrashIcon width="1.2em" height="1.2em" />
          </HeaderButtonWithText>
        )}
        {idx === 0 && <TrashIcon width="1.6em" height="1.6em" opacity={0.0} />}
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
  const client = useContext(GUIClientContext);
  const defaultModel = useSelector(defaultModelSelector);
  const allModels = useSelector(
    (state: RootStore) => state.serverState.config.models
  );

  const navigate = useNavigate();

  const DEFAULT_OPTION = {
    value: "GPT-4",
    title: "GPT-4",
  };
  const [options, setOptions] = useState<Option[]>([DEFAULT_OPTION]);

  useEffect(() => {
    if (!allModels) {
      setOptions([DEFAULT_OPTION]);
      return;
    }
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

  return (
    <>
      <GridDiv>
        <StyledListbox
          value={"GPT-4"}
          onChange={(val: string) => {
            if (val === defaultModel?.title) return;
            client?.setModelForRoleFromTitle("default", val);
          }}
          defaultValue={"GPT-4"}
        >
          <div className="relative">
            <StyledListboxButton>
              <div>{modelSelectTitle(defaultModel) || "GPT-4"}</div>
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
                      <ListBoxOption option={option} idx={idx} />
                    ))}
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
