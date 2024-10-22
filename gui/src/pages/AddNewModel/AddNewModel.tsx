import { ArrowLeftIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import _ from "lodash";
import React, { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  grid-template-columns: 1fr;
  grid-gap: 2rem;
  padding: 1rem;
  justify-items: center;
  align-items: center;
`;

function Models() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const ideMessenger = useContext(IdeMessengerContext);

  useNavigationListener();

  const [showOtherProviders, setShowOtherProviders] = useState(
    location.state?.showOtherProviders ?? false
  );

  const handleOtherClick = () => setShowOtherProviders(true);

  const handleBackArrowClick = () => {
    if (location.state?.referrer) {
      navigate(location.state.referrer);
    } else if (showOtherProviders) {
      setShowOtherProviders(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="overflow-y-scroll mb-6">
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
          onClick={handleBackArrowClick}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Add Model</h3>
      </div>
      <br />
      <IntroDiv style={{ textAlign: "center" }}>
        To add a model, select one of the options below:
      </IntroDiv>
      <GridDiv>
        {!showOtherProviders ? (
          <>
            <ModelCard
              key="pearai_server"
              title={providers["pearai_server"].title}
              description={providers["pearai_server"].description}
              tags={providers["pearai_server"].tags}
              icon={providers["pearai_server"].icon}
              onClick={(e) => {
                console.log(`/addModel/provider/pearai_server`);
                navigate(`/addModel/provider/pearai_server`);
              }}
            />
            <ModelCard
              key="other"
              title={providers["other"].title}
              description={providers["other"].description}
              tags={providers["other"].tags}
              icon={providers["other"].icon}
              onClick={handleOtherClick}
            />
          </>
        ) : (
          <>
            {Object.entries(providers).map(([providerName, providerInfo], i) => (
              providerInfo.showInMenu !== false && (
                <ModelCard
                  key={`${providerName}-${i}`}
                  title={providerInfo.title}
                  description={providerInfo.description}
                  tags={providerInfo.tags}
                  icon={providerInfo.icon}
                  onClick={(e) => {
                    console.log(`/addModel/provider/${providerName}`);
                    navigate(`/addModel/provider/${providerName}`);
                  }}
                />
              )
            ))}
          </>
        )}
      </GridDiv>
      <div style={{ padding: "8px" }}>
        <hr style={{ color: lightGray, border: `1px solid ${lightGray}` }} />
        <p style={{ color: lightGray }}>Or edit manually in config.json:</p>
        <CustomModelButton
          disabled={false}
          onClick={() => ideMessenger.post("openConfigJson", undefined)}
        >
          <h3 className="text-center my-2">Open config.json</h3>
        </CustomModelButton>
      </div>
    </div>
  );
}

export default Models;
