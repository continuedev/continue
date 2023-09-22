import React, { useContext } from "react";
import styled from "styled-components";
import { buttonColor, defaultBorderRadius, lightGray, vscForeground } from ".";
import { setShowDialog } from "../redux/slices/uiStateSlice";
import { GUIClientContext } from "../App";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootStore } from "../redux/store";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import ReactDOM from "react-dom";

export enum ModelTag {
  "Requires API Key" = "Requires API Key",
  "Local" = "Local",
  "Free" = "Free",
  "Open-Source" = "Open-Source",
}

const MODEL_TAG_COLORS: any = {};
MODEL_TAG_COLORS[ModelTag["Requires API Key"]] = "#FF0000";
MODEL_TAG_COLORS[ModelTag["Local"]] = "#00bb00";
MODEL_TAG_COLORS[ModelTag["Open-Source"]] = "#0033FF";
MODEL_TAG_COLORS[ModelTag["Free"]] = "#ffff00";

export interface ModelInfo {
  title: string;
  class: string;
  args: any;
  description: string;
  icon?: string;
  tags?: ModelTag[];
}

const Div = styled.div<{ color: string }>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  cursor: pointer;
  padding: 4px 8px;
  position: relative;
  width: 100%;
  transition: all 0.5s;

  &:hover {
    border: 1px solid ${(props) => props.color};
    background-color: ${(props) => props.color}22;
  }
`;

interface ModelCardProps {
  modelInfo: ModelInfo;
}

function ModelCard(props: ModelCardProps) {
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  return (
    <Div
      color={buttonColor}
      onClick={(e) => {
        if ((e.target as any).closest("a")) {
          return;
        }
        client?.addModelForRole(
          "*",
          props.modelInfo.class,
          props.modelInfo.args
        );
        dispatch(setShowDialog(false));
        navigate("/");
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {vscMediaUrl && (
          <img
            src={`${vscMediaUrl}/logos/${props.modelInfo.icon}`}
            height="24px"
            style={{ marginRight: "10px" }}
          />
        )}
        <h3>{props.modelInfo.title}</h3>
      </div>
      {props.modelInfo.tags?.map((tag) => {
        return (
          <span
            style={{
              backgroundColor: `${MODEL_TAG_COLORS[tag]}55`,
              color: "white",
              padding: "2px 4px",
              borderRadius: defaultBorderRadius,
              marginRight: "4px",
            }}
          >
            {tag}
          </span>
        );
      })}
      <p>{props.modelInfo.description}</p>

      <a
        style={{
          position: "absolute",
          right: "8px",
          top: "8px",
        }}
        href={`https://continue.dev/docs/reference/Models/${props.modelInfo.class.toLowerCase()}`}
        target="_blank"
      >
        <HeaderButtonWithText text="Read the docs">
          <BookOpenIcon width="1.6em" height="1.6em" />
        </HeaderButtonWithText>
      </a>
    </Div>
  );
}

export default ModelCard;
