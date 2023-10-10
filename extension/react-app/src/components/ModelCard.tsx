import React, { useContext, useState } from "react";
import styled from "styled-components";
import { buttonColor, defaultBorderRadius, lightGray } from ".";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { MODEL_PROVIDER_TAG_COLORS, PackageDimension } from "../util/modelData";
import InfoHover from "./InfoHover";

const Div = styled.div<{ color: string; disabled: boolean; hovered: boolean }>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  position: relative;
  width: 100%;
  transition: all 0.5s;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : props.hovered
      ? `
    border: 1px solid ${props.color};
    background-color: ${props.color}22;
    cursor: pointer;`
      : ""}
`;

const DimensionsDiv = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-left: auto;
  padding: 4px;
  /* width: fit-content; */

  border-top: 1px solid ${lightGray};
`;

const DimensionOptionDiv = styled.div<{ selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 8px;
  background-color: ${lightGray};
  padding: 4px;
  border-radius: ${defaultBorderRadius};
  outline: 0.5px solid ${lightGray};

  ${(props) =>
    props.selected &&
    `
    background-color: ${buttonColor};
    color: white;
  `}

  &:hover {
    cursor: pointer;
    outline: 1px solid ${buttonColor};
  }
`;

interface ModelCardProps {
  title: string;
  description: string;
  tags?: string[];
  refUrl?: string;
  icon?: string;
  onClick: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    dimensionChoices?: string[]
  ) => void;
  disabled?: boolean;
  dimensions?: PackageDimension[];
}

function ModelCard(props: ModelCardProps) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  const [dimensionChoices, setDimensionChoices] = useState<string[]>(
    props.dimensions?.map((d) => Object.keys(d.options)[0]) || []
  );

  const [hovered, setHovered] = useState(false);

  return (
    <Div
      disabled={props.disabled || false}
      color={buttonColor}
      hovered={hovered}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="px-2 py-1"
        onClick={
          props.disabled
            ? undefined
            : (e) => {
                if ((e.target as any).closest("a")) {
                  return;
                }
                props.onClick(e, dimensionChoices);
              }
        }
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
      </div>

      {props.dimensions?.length && (
        <DimensionsDiv>
          {props.dimensions?.map((dimension, i) => {
            return (
              <div className="flex items-center">
                <InfoHover msg={dimension.description} />
                <p className="mx-2 text-sm my-0 py-0">{dimension.name}</p>
                {Object.keys(dimension.options).map((key) => {
                  return (
                    <DimensionOptionDiv
                      onClick={(e) => {
                        e.stopPropagation();
                        const newChoices = [...dimensionChoices];
                        newChoices[i] = key;
                        setDimensionChoices(newChoices);
                      }}
                      selected={dimensionChoices[i] === key}
                    >
                      {key}
                    </DimensionOptionDiv>
                  );
                })}
              </div>
            );
          })}
        </DimensionsDiv>
      )}
    </Div>
  );
}

export default ModelCard;
