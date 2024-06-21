import React, { useContext } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Button, Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { setShowDialog } from "../../redux/slices/uiStateSlice";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

export const ftl = () => {
  // const ftc = parseInt(localStorage.getItem("ftc"));
  return 50;
};

function FTCDialog() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = React.useState("");
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className="p-4">
      <h3>Free Trial Limit Reached</h3>
      <p>
        You've reached the free trial limit of {ftl()} free inputs. To keep
        using Continue, you can either use your own API key, or use a local LLM.
        To read more about the options, see our{" "}
        <a href="https://docs.continue.dev/setup/overview" target="_blank">
          documentation
        </a>
        .
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
            ideMessenger.post("config/addOpenAiKey", apiKey);
            dispatch(setShowDialog(false));
            dispatch(setDefaultModel({ title: "GPT-4" }));
          }}
        >
          Use my API key
        </Button>
      </GridDiv>
    </div>
  );
}

export default FTCDialog;
