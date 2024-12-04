import { ArrowLeftIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import _ from "lodash";
import React, { useContext } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
} from "../../components";
import ModelCard from "../../components/modelSelection/ModelCard";
import Toggle from "../../components/modelSelection/Toggle";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { ModelPackage, models } from "./configs/models";
import { providers } from "./configs/providers";
import { CustomModelButton } from "./ConfigureProvider";
import { setDefaultModel } from "../../redux/slices/configSlice";

const IntroDiv = styled.div`
  padding: 8px 12px;
  border-radius: ${defaultBorderRadius};
  border: 1px solid ${lightGray};
  margin-top: 1rem;
  margin-bottom: 1rem;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 1.25rem;
  justify-items: center;
  align-items: center;
`;

/**
 * Used to display groupings in the Models tab
 */
const modelsByProvider: Record<string, ModelPackage[]> = {
  "Open AI": [models.gpt4turbo, models.gpt4o, models.gpt35turbo],
  Anthropic: [models.claude3Opus, models.claude3Sonnet, models.claude3Haiku],
  Mistral: [
    models.codestral,
    models.mistral7b,
    models.mistral8x7b,
    models.mistral8x22b,
    models.mistralSmall,
    models.mistralLarge,
  ],
  Cohere: [models.commandR, models.commandRPlus],
  DeepSeek: [models.deepseekCoderApi, models.deepseekChatApi],
  Gemini: [models.geminiPro, models.gemini15Pro, models.gemini15Flash],
  "Open Source": [models.llama3Chat, models.mistralOs, models.deepseek],
};

function AddNewModel() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  useNavigationListener();
  const ideMessenger = useContext(IdeMessengerContext);

  const [providersSelected, setProvidersSelected] = React.useState(true);

  return (
    <div className="mb-6 overflow-y-scroll">
      <div
        className="sticky top-0 m-0 flex items-center p-0"
        style={{
          borderBottom: `0.5px solid ${lightGray}`,
          backgroundColor: vscBackground,
          zIndex: 2,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="ml-4 inline-block cursor-pointer"
        />
        <h3 className="m-2 inline-block text-lg font-bold">Add a new model</h3>
      </div>
      <br />
      <div className="px-6">
        <IntroDiv>
          To add a new model you can either:
          <ul>
            <li>
              Start by selecting and configuring a provider, then choosing your
              model
            </li>
            <li>Select a specific model directly</li>
          </ul>
          <Link
            target="_blank"
            to="https://docs.continue.dev/model-setup/overview"
          >
            Visit our setup overview docs
          </Link>{" "}
          to learn more.
        </IntroDiv>

        <div className="col-span-full py-4">
          <Toggle
            selected={providersSelected}
            optionOne={"Start with a provider"}
            optionTwo={"Select a specific model"}
            onClick={() => {
              setProvidersSelected((prev) => !prev);
            }}
          ></Toggle>
        </div>

        {providersSelected ? (
          <>
            <div className="col-span-full mb-8 text-center leading-relaxed">
              <h2 className="mb-0">Providers</h2>
              <p className="mt-2">
                Select a provider below, or configure your own in{" "}
                <code>config.json</code>
              </p>
            </div>

            <GridDiv>
              {Object.entries(providers).map(([providerName, modelInfo], i) => (
                <ModelCard
                  key={`${providerName}-${i}`}
                  title={modelInfo.title}
                  description={modelInfo.description}
                  tags={modelInfo.tags}
                  icon={modelInfo.icon}
                  refUrl={`https://docs.continue.dev/reference/Model%20Providers/${
                    modelInfo.refPage || modelInfo.provider.toLowerCase()
                  }`}
                  onClick={(e) => {
                    console.log(`/addModel/provider/${providerName}`);
                    navigate(`/addModel/provider/${providerName}`);
                  }}
                />
              ))}
            </GridDiv>
          </>
        ) : (
          <>
            <div className="col-span-full text-center leading-relaxed">
              <h2 className="mb-0">Models</h2>
              <p className="mt-2">
                Select a model from the most popular options below, or configure
                your own in <code>config.json</code>
              </p>
            </div>

            {Object.entries(modelsByProvider).map(
              ([providerTitle, modelConfigsByProviderTitle]) => (
                <div className="mb-6 flex flex-col">
                  <div className="mb-4 w-full items-center">
                    <h3 className="">{providerTitle}</h3>
                    <hr
                      style={{
                        height: "0px",
                        width: "100%",
                        color: lightGray,
                        border: `1px solid ${lightGray}`,
                        borderRadius: "2px",
                      }}
                    />
                  </div>

                  <GridDiv>
                    {modelConfigsByProviderTitle.map((config) => (
                      <ModelCard
                        title={config.title}
                        description={config.description}
                        tags={config.tags}
                        icon={config.icon}
                        dimensions={config.dimensions}
                        providerOptions={config.providerOptions}
                        onClick={(e, dimensionChoices, selectedProvider) => {
                          const model = {
                            ...config.params,
                            ..._.merge(
                              {},
                              ...(config.dimensions?.map((dimension, i) => {
                                if (!dimensionChoices?.[i]) return {};
                                return {
                                  ...dimension.options[dimensionChoices[i]],
                                };
                              }) || []),
                            ),
                            provider: providers[selectedProvider].provider,
                          };
                          ideMessenger.post("config/addModel", { model });
                          dispatch(
                            setDefaultModel({
                              title: model.title,
                              force: true,
                            }),
                          );
                          navigate("/");
                        }}
                      />
                    ))}
                  </GridDiv>
                </div>
              ),
            )}
          </>
        )}

        <CustomModelButton
          className="mt-12"
          disabled={false}
          onClick={(e) => {
            ideMessenger.post("config/openProfile", {
              profileId: "local",
            });
          }}
        >
          <h3 className="my-2 text-center">
            <Cog6ToothIcon className="inline-block h-5 w-5 px-4 align-middle" />
            Open config.json
          </h3>
        </CustomModelButton>
      </div>
    </div>
  );
}

export default AddNewModel;
