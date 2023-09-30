import React, { useContext } from "react";
import styled from "styled-components";
import { buttonColor, defaultBorderRadius, lightGray } from ".";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { MODEL_PROVIDER_TAG_COLORS } from "../util/modelData";

const Div = styled.div<{ color: string; disabled: boolean }>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  position: relative;
  width: 100%;
  transition: all 0.5s;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : `
  &:hover {
    border: 1px solid ${props.color};
    background-color: ${props.color}22;
    cursor: pointer;
  }
  `}
`;

interface ModelCardProps {
  title: string;
  description: string;
  tags?: string[];
  refUrl?: string;
  icon?: string;
  onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  disabled?: boolean;
}

function ModelCard(props: ModelCardProps) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  return (
    <Div
      disabled={props.disabled || false}
      color={buttonColor}
      onClick={props.disabled ? undefined : (e) => props.onClick(e)}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {vscMediaUrl && props.icon && (
          <img
            src={`${vscMediaUrl}/logos/${props.icon}`}
            height="24px"
            style={{ marginRight: "10px" }}
          />
        )}
        <h3>{props.title}</h3>
      </div>
      {props.tags?.map((tag) => {
        return (
          <span
            style={{
              backgroundColor: `${MODEL_PROVIDER_TAG_COLORS[tag]}55`,
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
      <p>{props.description}</p>

      {props.refUrl && (
        <a
          style={{
            position: "absolute",
            right: "8px",
            top: "8px",
          }}
          href={props.refUrl}
          target="_blank"
        >
          <HeaderButtonWithText text="Read the docs">
            <BookOpenIcon width="1.6em" height="1.6em" />
          </HeaderButtonWithText>
        </a>
      )}
    </Div>
  );
}

export default ModelCard;
