import { CubeIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { lightGray } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../../../redux/slices/configSlice";
import { getFontSize, getMetaKeyLabel } from "../../../util";
import { Divider, Option, OptionDiv } from "./shared";

export interface ModelOption {
  value: string;
  title: string;
  apiKey?: string;
}

export function modelSelectTitle(model: any): string {
  if (model?.title) return model?.title;
  if (model?.model !== undefined && model?.model.trim() !== "") {
    if (model?.class_name) {
      return `${model?.class_name} - ${model?.model}`;
    }
    return model?.model;
  }
  return model?.class_name;
}

interface ModelSelectProps {
  selectedProfileId: string;
  onClickAddModel: (e: any) => void;
}

export function ModelSelect(props: ModelSelectProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const defaultModel = useAppSelector(selectDefaultModel);
  const allModels = useAppSelector((state) => state.config.config.models);
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [sortedOptions, setSortedOptions] = useState<ModelOption[]>([]);

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

  function onModelChange(modelTitle: string) {
    if (modelTitle === defaultModel?.title) return;
    dispatch(setDefaultModel({ title: modelTitle }));
  }

  return (
    <div className="xs:flex hidden min-w-0 flex-col">
      <div className={`max-h-[300px] overflow-y-scroll`}>
        {sortedOptions.map((option, idx) => (
          <Option
            idx={idx}
            key={idx}
            onClick={() => onModelChange(option.title)}
            disabled={option.apiKey === ""}
            selected={option.title === defaultModel?.title}
            showConfigure={false}
            onConfigure={() => {}}
          >
            <div className="flex flex-grow items-center">
              <CubeIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="flex-grow">
                {option.title}
                {option.apiKey === "" && (
                  <span className="ml-2 text-[10px] italic">
                    (Missing API key)
                  </span>
                )}
              </span>
            </div>
          </Option>
        ))}
      </div>

      <div className="mt-auto">
        {props.selectedProfileId === "local" && (
          <>
            <OptionDiv key={options.length} onClick={props.onClickAddModel}>
              <div className="flex items-center py-0.5">
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Chat model
              </div>
            </OptionDiv>
          </>
        )}

        <Divider className="!my-0" />

        <span
          className="block px-3 py-2"
          style={{ color: lightGray, fontSize: getFontSize() - 4 }}
        >
          <code>{getMetaKeyLabel()}⇧'</code> toggle model
        </span>
      </div>
    </div>
  );
}
