import React, { useCallback, useContext, useEffect, useState } from "react";
import ModelCard from "../components/ModelCard";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import {
  Input,
  defaultBorderRadius,
  lightGray,
  vscBackground,
} from "../components";
import { Form, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { GUIClientContext } from "../App";
import { setShowDialog } from "../redux/slices/uiStateSlice";
import { useParams } from "react-router-dom";
import {
  MODEL_INFO,
  MODEL_PROVIDER_TAG_COLORS,
  ModelInfo,
} from "../util/modelData";
import { RootStore } from "../redux/store";
import StyledMarkdownPreview from "../components/StyledMarkdownPreview";
import { getFontSize } from "../util";
import { FormProvider, useForm } from "react-hook-form";
import _ from "lodash";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 2rem;
  padding: 1rem;
  justify-items: center;
  align-items: center;
`;

const CustomModelButton = styled.div<{ disabled: boolean }>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  transition: all 0.5s;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : `
  &:hover {
    border: 1px solid #be1b55;
    background-color: #be1b5522;
    cursor: pointer;
  }
  `}
`;

function ModelConfig() {
  const formMethods = useForm();
  const { modelName } = useParams();

  const [modelInfo, setModelInfo] = useState<ModelInfo | undefined>(undefined);

  useEffect(() => {
    if (modelName) {
      setModelInfo(MODEL_INFO[modelName]);
    }
  }, [modelName]);

  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  const disableModelCards = useCallback(() => {
    return (
      modelInfo?.collectInputFor?.some((d) => {
        if (!d.required) return false;
        const val = formMethods.watch(d.key);
        return (
          typeof val === "undefined" || (typeof val === "string" && val === "")
        );
      }) || false
    );
  }, [modelInfo, formMethods]);

  return (
    <FormProvider {...formMethods}>
      <div className="overflow-y-scroll">
        <div
          className="items-center flex m-0 p-0 sticky top-0"
          style={{
            borderBottom: `0.5px solid ${lightGray}`,
            backgroundColor: vscBackground,
            zIndex: 2,
          }}
        >
          <ArrowLeftIcon
            width="1.2em"
            height="1.2em"
            onClick={() => navigate("/models")}
            className="inline-block ml-4 cursor-pointer"
          />
          <h3 className="text-lg font-bold m-2 inline-block">
            Configure Model
          </h3>
        </div>

        <div className="px-2">
          <div style={{ display: "flex", alignItems: "center" }}>
            {vscMediaUrl && modelInfo?.icon && (
              <img
                src={`${vscMediaUrl}/logos/${modelInfo?.icon}`}
                height="24px"
                style={{ marginRight: "10px" }}
              />
            )}
            <h2>{modelInfo?.title}</h2>
          </div>
          {modelInfo?.tags?.map((tag) => {
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
          <StyledMarkdownPreview
            className="mt-2"
            source={modelInfo?.longDescription || modelInfo?.description}
            maxHeight={200}
          />
          <br />

          {(modelInfo?.collectInputFor?.filter((d) => d.required).length || 0) >
            0 && (
            <>
              <h3 className="mb-2">Enter required parameters</h3>

              {modelInfo?.collectInputFor
                ?.filter((d) => d.required)
                .map((d) => {
                  return (
                    <div>
                      <label htmlFor={d.key}>{d.key}</label>
                      <Input
                        type={d.inputType}
                        id={d.key}
                        className="border-2 border-gray-200 rounded-md p-2 m-2"
                        placeholder={d.key}
                        defaultValue={d.defaultValue}
                        min={d.min}
                        max={d.max}
                        step={d.step}
                        {...formMethods.register(d.key, {
                          required: true,
                        })}
                      />
                    </div>
                  );
                })}
            </>
          )}

          {(modelInfo?.collectInputFor?.filter((d) => !d.required).length ||
            0) > 0 && (
            <details>
              <summary className="mb-2">
                <b>Advanced (optional)</b>
              </summary>

              {modelInfo?.collectInputFor?.map((d) => {
                if (d.required) return null;
                return (
                  <div>
                    <label htmlFor={d.key}>{d.key}</label>
                    <Input
                      type={d.inputType}
                      id={d.key}
                      className="border-2 border-gray-200 rounded-md p-2 m-2"
                      placeholder={d.key}
                      defaultValue={d.defaultValue}
                      min={d.min}
                      max={d.max}
                      step={d.step}
                      {...formMethods.register(d.key, {
                        required: false,
                      })}
                    />
                  </div>
                );
              })}
            </details>
          )}

          <h3 className="mb-2">Select a model preset</h3>
        </div>
        <GridDiv>
          {modelInfo?.packages.map((pkg) => {
            return (
              <ModelCard
                disabled={disableModelCards()}
                title={pkg.title}
                description={pkg.description}
                tags={pkg.tags}
                refUrl={pkg.refUrl}
                icon={pkg.icon || modelInfo.icon}
                dimensions={pkg.dimensions}
                onClick={(e, dimensionChoices) => {
                  if (disableModelCards()) return;
                  const formParams: any = {};
                  for (const d of modelInfo.collectInputFor || []) {
                    formParams[d.key] =
                      d.inputType === "text"
                        ? formMethods.watch(d.key)
                        : parseFloat(formMethods.watch(d.key));
                  }

                  client?.addModelForRole("*", modelInfo.class, {
                    ...pkg.params,
                    ...modelInfo.params,
                    ..._.merge(
                      {},
                      ...(pkg.dimensions?.map((dimension, i) => {
                        if (!dimensionChoices?.[i]) return {};
                        return {
                          ...dimension.options[dimensionChoices[i]],
                        };
                      }) || [])
                    ),
                    ...formParams,
                  });
                  navigate("/");
                }}
              />
            );
          })}

          <CustomModelButton
            disabled={disableModelCards()}
            onClick={(e) => {
              if (!modelInfo || disableModelCards()) return;
              const formParams: any = {};
              for (const d of modelInfo.collectInputFor || []) {
                formParams[d.key] =
                  d.inputType === "text"
                    ? formMethods.watch(d.key)
                    : parseFloat(formMethods.watch(d.key));
              }

              client?.addModelForRole("*", modelInfo.class, {
                ...modelInfo.packages[0]?.params,
                ...modelInfo.params,
                ...formParams,
              });
              navigate("/");
            }}
          >
            <h3 className="text-center my-2">Configure Model in config.py</h3>
          </CustomModelButton>
        </GridDiv>
      </div>
    </FormProvider>
  );
}

export default ModelConfig;
