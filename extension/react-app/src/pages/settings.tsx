import React, { useContext, useEffect, useState } from "react";
import { GUIClientContext } from "../App";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { useNavigate } from "react-router-dom";
import { ContinueConfig } from "../../../schema/ContinueConfig";
import { Button, TextArea, lightGray, vscForeground } from "../components";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Loader from "../components/Loader";
import InfoHover from "../components/InfoHover";
import { useForm } from "react-hook-form";

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

function Settings() {
  const { register, handleSubmit, watch } = useForm<ContinueConfig>();
  const onSubmit = (data: ContinueConfig) => console.log(data);

  const navigate = useNavigate();
  const client = useContext(GUIClientContext);
  const config = useSelector((state: RootStore) => state.serverState.config);

  const submitChanges = () => {
    if (!client) return;

    const systemMessage = watch("system_message");
    const temperature = watch("temperature");

    if (systemMessage) client.setSystemMessage(systemMessage);
    if (temperature) client.setTemperature(temperature);
  };

  const submitAndLeave = () => {
    submitChanges();
    navigate("/");
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="items-center flex">
          <ArrowLeftIcon
            width="1.4em"
            height="1.4em"
            onClick={submitAndLeave}
            className="inline-block ml-4 cursor-pointer"
          />
          <h1 className="text-2xl font-bold m-4 inline-block">Settings</h1>
        </div>
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
              placeholder="Enter system message"
              {...register("system_message")}
              defaultValue={config.system_message}
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
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                defaultValue={config.temperature}
                className="w-full outline-none border-none"
                {...register("temperature")}
              />
              <p>1</p>
            </div>
            <div className="text-center" style={{ marginTop: "-25px" }}>
              <p className="text-sm text-gray-500">
                {watch("temperature") || config.temperature || "-"}
              </p>
            </div>
            <Hr />

            <h3 className="flex gap-1">Models</h3>
            <p>Default</p>

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
          </div>
        ) : (
          <Loader />
        )}
      </form>

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
  );
}

export default Settings;
