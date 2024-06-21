import { ArrowLeftIcon } from "@heroicons/react/24/outline";
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
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { ModelPackage, models } from "./configs/models";
import { providers } from "./configs/providers";
import { CustomModelButton } from "./ConfigureProvider";

const IntroDiv = styled.div`
  padding: 8px 12px;
  border-radius: ${defaultBorderRadius};
  border: 1px solid ${lightGray};
  margin: 1rem;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 2rem;
  padding: 1rem;
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
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Add a new model</h3>
      </div>
      <br />
      <IntroDiv>
        To add a new model you can either:
        <ul>
          <li>
            Start by selecting and configuring a provider, then choosing your
            model
          </li>
          <li>Select a specific model directly</li>
        </ul>
        <Link to="https://docs.continue.dev/model-setup/overview">
          Visit our setup overview docs
        </Link>{" "}
        to learn more.
      </IntroDiv>

      <GridDiv>
        <Toggle
          selected={providersSelected}
          optionOne={"Start with a provider"}
          optionTwo={"Select a specific model"}
          onClick={() => {
            setProvidersSelected((prev) => !prev);
          }}
        ></Toggle>
        {providersSelected ? (
          <>
            <div className="text-center">
              <h2>Providers</h2>
              <p>
                Select a provider below, or configure your own in{" "}
                <code>config.json</code>
              </p>
            </div>

            {Object.entries(providers).map(([providerName, modelInfo]) => (
              <ModelCard
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
          </>
        ) : (
          <>
            <div className="text-center">
              <h2>Models</h2>
              <p>
                Select a model from the most popular options below, or configure
                your own in <code>config.json</code>
              </p>
            </div>

            {Object.entries(modelsByProvider).map(
              ([providerTitle, modelConfigsByProviderTitle]) => (
                <div>
                  <div className="-my-8 grid grid-cols-[auto_1fr] w-full items-center mb-2">
                    <h3 className="">{providerTitle}</h3>
                    <hr
                      className="ml-2"
                      style={{
                        height: "0px",
                        width: "calc(100% - 16px)",
                        color: lightGray,
                        border: `1px solid ${lightGray}`,
                        borderRadius: "2px",
                      }}
                    ></hr>
                  </div>

                  {modelConfigsByProviderTitle.map((config) => (
                    <div className="mb-8">
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
                    </div>
                  ))}
                </div>
              ),
            )}
          </>
        )}

        <CustomModelButton
          className="w-full"
          disabled={false}
          onClick={(e) => {
            ideMessenger.post("openConfigJson", undefined);
          }}
        >
          <h3 className="text-center my-2">Open config.json</h3>
        </CustomModelButton>
      </GridDiv>
    </div>
  );
}

export default AddNewModel;
