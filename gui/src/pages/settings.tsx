import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ContinueConfig } from "core";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  NumberInput,
  TextArea,
  lightGray,
  vscBackground,
  vscForeground,
  vscInputBackground,
} from "../components";
import InfoHover from "../components/InfoHover";
import Loader from "../components/loaders/Loader";
import { RootState } from "../redux/store";
import { getFontSize, getPlatform } from "../util";
import { postToIde } from "../util/ide";

const Hr = styled.hr`
  border: 0.5px solid ${lightGray};
`;

const CancelButton = styled(Button)`
  background-color: transparent;
  color: ${lightGray};
  border: 1px solid ${lightGray};
  &:hover {
    background-color: ${lightGray};
    color: black;
  }
`;

const SaveButton = styled(Button)`
  &:hover {
    opacity: 0.8;
  }
`;

const Slider = styled.input.attrs({ type: "range" })`
  --webkit-appearance: none;
  width: 100%;
  background-color: ${vscInputBackground};
  outline: none;
  border: none;
  opacity: 0.7;
  -webkit-transition: 0.2s;
  transition: opacity 0.2s;
  &:hover {
    opacity: 1;
  }
  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 8px;
    cursor: pointer;
    background: ${lightGray};
    border-radius: 4px;
  }
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 8px;
    height: 8px;
    cursor: pointer;
    margin-top: -3px;
  }
  &::-moz-range-thumb {
    width: 8px;
    height: 8px;
    cursor: pointer;
    margin-top: -3px;
  }

  &:focus {
    outline: none;
    border: none;
  }
`;

const ConfigJsonButton = styled(Button)`
  padding: 2px 4px;
  margin-left: auto;
  margin-right: 4px;
  background-color: transparent;
  color: ${vscForeground};
  border: 1px solid ${lightGray};
  &:hover {
    background-color: ${lightGray};
  }
`;

const ALL_MODEL_ROLES = ["default", "summarize", "edit", "chat"];

function Settings() {
  const formMethods = useForm<ContinueConfig>();
  const onSubmit = (data: ContinueConfig) => console.log(data);

  const navigate = useNavigate();
  const config = useSelector((state: RootState) => state.state.config);
  const dispatch = useDispatch();

  const submitChanges = () => {
    // TODO
    // if (!client) return;
    // const systemMessage = formMethods.watch("system_message") as
    //   | string
    //   | undefined;
    // const temperature = formMethods.watch("temperature") as number | undefined;
    // // const models = formMethods.watch("models");
    // client.setSystemMessage(systemMessage || "");
    // if (temperature) client.setTemperature(temperature);
    // if (models) {
    //   for (const role of ALL_MODEL_ROLES) {
    //     if (models[role]) {
    //       client.setModelForRole(role, models[role] as string, models[role]);
    //     }
    //   }
    // }
  };

  const submitAndLeave = () => {
    submitChanges();
    navigate("/");
  };

  useEffect(() => {
    if (!config) return;

    formMethods.setValue("systemMessage", config.systemMessage);
    formMethods.setValue(
      "completionOptions.temperature",
      config.completionOptions?.temperature
    );
  }, [config]);

  return (
    <FormProvider {...formMethods}>
      <div className="overflow-y-scroll">
        <div
          className="items-center flex sticky top-0"
          style={{
            borderBottom: `0.5px solid ${lightGray}`,
            backgroundColor: vscBackground,
          }}
        >
          <ArrowLeftIcon
            width="1.2em"
            height="1.2em"
            onClick={submitAndLeave}
            className="inline-block ml-4 cursor-pointer"
          />
          <h3 className="text-lg font-bold m-2 inline-block">Settings</h3>
          <ConfigJsonButton
            onClick={() => {
              postToIde("showFile", {
                filepath:
                  getPlatform() == "windows"
                    ? "~\\.continue\\config.json"
                    : "~/.continue/config.json",
              });
            }}
          >
            Open config.json
          </ConfigJsonButton>
        </div>
        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          {config ? (
            <div className="p-2">
              <h3 className="flex gap-1">
                System Message
                <InfoHover
                  msg={`Set a system message with information that the LLM should always
              keep in mind (e.g. "Please give concise answers. Always respond in
              Spanish.")`}
                />
              </h3>
              <TextArea
                placeholder="Enter a system message (e.g. 'Always respond in German')"
                {...formMethods.register("systemMessage")}
              />

              <Hr />
              <h3 className="flex gap-1">
                Temperature
                <InfoHover
                  msg={`Set temperature to any value between 0 and 1. Higher values will
            make the LLM more creative, while lower values will make it more
            predictable.`}
                />
              </h3>
              <div className="flex justify-between mx-16 gap-1">
                <p>0</p>
                <Slider
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  {...formMethods.register("completionOptions.temperature")}
                />
                <p>1</p>
              </div>
              <div className="text-center" style={{ marginTop: "-25px" }}>
                <p className="text-sm text-gray-500">
                  {(formMethods.watch("completionOptions.temperature") as
                    | number
                    | undefined) ||
                    config.completionOptions?.temperature ||
                    "-"}
                </p>
              </div>
              <Hr />

              {/**
              <h3 className="flex gap-1">Models</h3>
              {ALL_MODEL_ROLES.map((role) => {
                return (
                  <>
                    <h4>{role}</h4>

                    <ModelSettings
                      role={role}
                      llm={(config.models as any)[role]}
                    />
                  </>
                );
              })}

              <Hr />

              <h3 className="flex gap-1">
                Custom Commands
                <InfoHover
                  msg={`Custom commands let you map a prompt to a shortened slash command.
            They are like slash commands, but more easily defined - write just a
            prompt instead of a Step class. Their output will always be in chat
            form`}
                />
              </h3>
              <Hr />

              <h3 className="flex gap-1">
                Context Providers
                <InfoHover
                  msg={`Context Providers let you type '@' and quickly reference sources of information, like files, GitHub Issues, webpages, and more.`}
                />
              </h3>
            */}
            </div>
          ) : (
            <Loader />
          )}
        </form>

        <hr />

        <div className="px-2">
          <h3>Appearance</h3>

          <p>Font Size</p>
          <NumberInput
            type="number"
            min="8"
            max="48"
            step="1"
            defaultValue={getFontSize()}
            onChange={(e) => {
              localStorage.setItem("fontSize", e.target.value);
            }}
          />
        </div>

        <div className="flex gap-2 justify-end px-4">
          <CancelButton
            onClick={() => {
              navigate("/");
            }}
          >
            Cancel
          </CancelButton>
          <SaveButton onClick={submitAndLeave}>Save</SaveButton>
        </div>
      </div>
    </FormProvider>
  );
}

export default Settings;
