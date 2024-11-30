import { BookOpenIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  greenButtonColor,
  lightGray,
  vscFocusBorder,
} from "..";
import { PackageDimension } from "../../pages/AddNewModel/configs/models";
import { providers } from "../../pages/AddNewModel/configs/providers";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import InfoHover from "../InfoHover";
import { ModelProviderTag } from "./ModelProviderTag";
import { ModelProviderTags } from "./utils";

interface ModelCardProps {
  title: string;
  description: string;
  tags?: ModelProviderTags[];
  refUrl?: string;
  icon?: string;
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    dimensionChoices?: string[],
    selectedProvider?: string,
  ) => void;
  disabled?: boolean;
  dimensions?: PackageDimension[];
  providerOptions?: string[];
}

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

  flex-wrap: wrap;
  row-gap: 12px;

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
    background-color: ${greenButtonColor};
    color: white;
  `}

  &:hover {
    cursor: pointer;
    outline: 1px solid ${vscFocusBorder};
  }
`;

function ModelCard(props: ModelCardProps) {
  const [dimensionChoices, setDimensionChoices] = useState<string[]>(
    props.dimensions?.map((d) => Object.keys(d.options)[0]) || [],
  );

  const [hovered, setHovered] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (props.providerOptions?.length) {
      setSelectedProvider(props.providerOptions[0]);
    }
  }, [props.providerOptions]);

  return (
    <Div
      disabled={props.disabled || false}
      color={greenButtonColor}
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
                props.onClick?.(e, dimensionChoices, selectedProvider);
              }
        }
      >
        <div
          className="mb-2"
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          {window.vscMediaUrl && props.icon && (
            <img
              src={`${window.vscMediaUrl}/logos/${props.icon}`}
              width="24px"
              height="24px"
              style={{
                borderRadius: "2px",
                padding: "4px",
                marginRight: "10px",
                objectFit: "contain",
              }}
            />
          )}
          <h3>{props.title}</h3>
        </div>

        {props.tags?.map((tag, i) => <ModelProviderTag key={i} tag={tag} />)}

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
            <HeaderButtonWithToolTip text="Read the docs">
              <BookOpenIcon width="1.6em" height="1.6em" />
            </HeaderButtonWithToolTip>
          </a>
        )}
      </div>

      {(props.dimensions?.length || props.providerOptions?.length) && (
        <DimensionsDiv>
          {props.dimensions?.map((dimension, i) => {
            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <InfoHover
                      id={dimension.name}
                      msg={dimension.description}
                    />
                    <p className="mx-2 my-0 py-0 text-sm">{dimension.name}</p>
                  </div>
                  <div className="flex items-center">
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
                </div>
                <br />
              </>
            );
          })}
          {props.providerOptions?.length && (
            <div className="rtl flex flex-wrap items-center justify-end">
              <div className="flex items-center">
                <InfoHover
                  id={"provider-info"}
                  msg={
                    "Select the provider through which you will access the model"
                  }
                />
              </div>
              <div className="rtl flex flex-wrap items-center justify-end">
                {props.providerOptions?.map((option, i) => {
                  const info = providers[option];
                  if (!info) {
                    return null;
                  }
                  return (
                    <HeaderButtonWithToolTip
                      text={info.title}
                      className="mx-1 items-center p-2 text-center"
                      style={{
                        backgroundColor:
                          (i === 0 &&
                            typeof selectedProvider === "undefined") ||
                          selectedProvider === option
                            ? greenButtonColor + "aa"
                            : undefined,
                      }}
                      onClick={() => {
                        setSelectedProvider(option);
                      }}
                    >
                      {window.vscMediaUrl && info.icon && (
                        <img
                          src={`${window.vscMediaUrl}/logos/${info.icon}`}
                          height="24px"
                        />
                      )}
                    </HeaderButtonWithToolTip>
                  );
                })}
              </div>
            </div>
          )}
        </DimensionsDiv>
      )}
    </Div>
  );
}

export default ModelCard;
