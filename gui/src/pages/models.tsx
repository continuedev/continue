import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import _ from "lodash";
import React, { useContext } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscBackground } from "../components";
import ModelCard from "../components/modelSelection/ModelCard";
import Toggle from "../components/modelSelection/Toggle";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { setDefaultModel } from "../redux/slices/stateSlice";
import { MODEL_INFO, PROVIDER_INFO } from "../util/modelData";
import { CustomModelButton } from "./modelconfig";

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

function Models() {
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
        <h3 className="text-lg font-bold m-2 inline-block">Add new model</h3>
      </div>
      <br />
      <Toggle
        selected={providersSelected}
        optionOne={"Providers"}
        optionTwo={"Models"}
        onClick={() => {
          setProvidersSelected((prev) => !prev);
        }}
      ></Toggle>
      <IntroDiv>
        To set up an LLM you will choose
        <ul>
          <li>
            a provider (the service used to run the LLM, e.g. Ollama,
            TogetherAI) and
          </li>
          <li>a model (the LLM being run, e.g. GPT-4, CodeLlama).</li>
        </ul>
        To read more about the options, check out our{" "}
        <a href="https://docs.continue.dev/model-setup/overview">overview</a> in
        the docs.
      </IntroDiv>
      {providersSelected ? (
        <GridDiv>
          {Object.entries(PROVIDER_INFO).map(([name, modelInfo]) => (
            <ModelCard
              title={modelInfo.title}
              description={modelInfo.description}
              tags={modelInfo.tags}
              icon={modelInfo.icon}
              refUrl={`https://docs.continue.dev/reference/Model%20Providers/${
                modelInfo.refPage || modelInfo.provider.toLowerCase()
              }`}
              onClick={(e) => {
                navigate(`/modelconfig/${name}`);
              }}
            />
          ))}
        </GridDiv>
      ) : (
        <GridDiv>
          {MODEL_INFO.map((pkg) => {
            if (typeof pkg === "string") {
              return (
                <div className="-my-8 grid grid-cols-[auto_1fr] w-full items-center">
                  <h3 className="">{pkg}</h3>
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
              );
            } else {
              return (
                <ModelCard
                  title={pkg.title}
                  description={pkg.description}
                  tags={pkg.tags}
                  icon={pkg.icon}
                  dimensions={pkg.dimensions}
                  providerOptions={pkg.providerOptions}
                  onClick={(e, dimensionChoices, selectedProvider) => {
                    const model = {
                      ...pkg.params,
                      ..._.merge(
                        {},
                        ...(pkg.dimensions?.map((dimension, i) => {
                          if (!dimensionChoices?.[i]) return {};
                          return {
                            ...dimension.options[dimensionChoices[i]],
                          };
                        }) || []),
                      ),
                      provider: PROVIDER_INFO[selectedProvider].provider,
                    };
                    ideMessenger.post("config/addModel", { model });
                    dispatch(
                      setDefaultModel({ title: model.title, force: true }),
                    );
                    navigate("/");
                  }}
                />
              );
            }
          })}
        </GridDiv>
      )}

      <div style={{ padding: "8px" }}>
        <hr style={{ color: lightGray, border: `1px solid ${lightGray}` }} />
        <p style={{ color: lightGray }}>
          OR choose from other providers / models by editing config.json.
        </p>
        <CustomModelButton
          disabled={false}
          onClick={(e) => {
            ideMessenger.post("openConfigJson", undefined);
          }}
        >
          <h3 className="text-center my-2">Open config.json</h3>
        </CustomModelButton>
      </div>
    </div>
  );
}

export default Models;
