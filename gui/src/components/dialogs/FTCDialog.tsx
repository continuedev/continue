import React from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Button, Input } from "..";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { setShowDialog } from "../../redux/slices/uiStateSlice";
import { postToIde } from "../../util/ide";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

function FTCDialog() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = React.useState("");
  const dispatch = useDispatch();

  return (
    <div className="p-4">
      <h3>Free Trial Limit Reached</h3>
      <p>
        You've reached the free trial limit of 250 free inputs with Continue's
        OpenAI API key. To keep using Continue, you can either use your own API
        key, or use a local LLM. To read more about the options, see our{" "}
        <a
          href="https://continue.dev/docs/customization/models"
          target="_blank"
        >
          documentation
        </a>
        . If you're just looking for fastest way to keep going, type '/config'
        to open your Continue config file and paste your API key into the
        OpenAIFreeTrial object.
      </p>

      <Input
        type="text"
        placeholder="Enter your OpenAI API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <GridDiv>
        <Button
          onClick={() => {
            dispatch(setShowDialog(false));
            navigate("/models");
          }}
        >
          Select model
        </Button>
        <Button
          disabled={!apiKey}
          onClick={() => {
            postToIde("config/addOpenAiKey", apiKey);
            dispatch(setShowDialog(false));
            dispatch(setDefaultModel("GPT-4"));
          }}
        >
          Use my API key
        </Button>
      </GridDiv>
    </div>
  );
}

export default FTCDialog;
