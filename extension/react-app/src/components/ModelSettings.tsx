import styled from "styled-components";
import { LLM } from "../../../schema/LLM";
import {
  Label,
  Select,
  TextInput,
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from ".";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

const Div = styled.div<{ dashed: boolean }>`
  border: 1px ${(props) => (props.dashed ? "dashed" : "solid")} ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 8px;
  margin-bottom: 16px;
`;

type ModelOption = "api_key" | "model" | "context_length";

const DefaultModelOptions: {
  [key: string]: { [key in ModelOption]?: string };
} = {
  OpenAI: {
    api_key: "",
    model: "gpt-4",
  },
  OpenAIFreeTrial: {
    api_key: "",
    model: "gpt-4",
  },
  Anthropic: {
    api_key: "",
    model: "claude-2",
  },
  default: {
    api_key: "",
    model: "gpt-4",
  },
};

function ModelSettings(props: { llm: any | undefined; role: string }) {
  const [modelOptions, setModelOptions] = useState<{
    [key in ModelOption]?: string;
  }>(DefaultModelOptions[props.llm?.class_name || "default"]);

  const { register, setValue, getValues } = useFormContext();

  return (
    <Div dashed={typeof props.llm === undefined}>
      {props.llm ? (
        <>
          <b>{props.role}</b>: <b> {props.llm.class_name || "gpt-4"}</b>
          <form>
            {typeof modelOptions.api_key !== undefined && (
              <>
                <Label>API Key</Label>
                <TextInput
                  type="text"
                  defaultValue={props.llm.api_key}
                  placeholder="API Key"
                  {...register(`models.${props.role}.api_key`)}
                />
              </>
            )}
            {modelOptions.model && (
              <>
                <Label>Model</Label>
                <TextInput
                  type="text"
                  defaultValue={props.llm.model}
                  placeholder="Model"
                  {...register(`models.${props.role}.model`)}
                />
              </>
            )}
          </form>
        </>
      ) : (
        <div>
          <b>Add Model</b>
          <div className="my-4">
            <Select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  e.target.value = "";
                }
              }}
            >
              <option disabled value="">
                Select Model Type
              </option>
              <option value="newModel1">New Model 1</option>
              <option value="newModel2">New Model 2</option>
              <option value="newModel3">New Model 3</option>
            </Select>
          </div>
        </div>
      )}
    </Div>
  );
}

export default ModelSettings;
