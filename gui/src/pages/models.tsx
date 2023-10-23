import React, { useContext } from "react";
import ModelCard from "../components/ModelCard";
import styled from "styled-components";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { lightGray, vscBackground } from "../components";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { GUIClientContext } from "../App";
import { setShowDialog } from "../redux/slices/uiStateSlice";
import { MODEL_INFO } from "../util/modelData";

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
  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
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
        <h3 className="text-lg font-bold m-2 inline-block">
          Select LLM Provider
        </h3>
      </div>
      <GridDiv>
        {Object.entries(MODEL_INFO).map(([name, modelInfo]) => (
          <ModelCard
            title={modelInfo.title}
            description={modelInfo.description}
            tags={modelInfo.tags}
            icon={modelInfo.icon}
            refUrl={`https://continue.dev/docs/reference/Models/${modelInfo.class.toLowerCase()}`}
            onClick={(e) => {
              navigate(`/modelconfig/${name}`);
            }}
          />
        ))}
      </GridDiv>
    </div>
  );
}

export default Models;
