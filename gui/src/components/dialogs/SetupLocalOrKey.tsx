import React from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Button, Input } from "..";
import { setDefaultModel } from "../../redux/slices/stateSlice";
import { setShowDialog } from "../../redux/slices/uiStateSlice";
import { ideRequest, postToIde } from "../../util/ide";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

function SetupLocalOrKeyDialog() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = React.useState("");
  const dispatch = useDispatch();

  return (
    <div className="p-4">
      <h3>Set up your own model</h3>
      <p>
        To keep using Continue after your free inputs, you can either use your
        own API key, or use a local LLM. To read more about the options, see our{" "}
        <a
          className="cursor-pointer"
          onClick={() =>
            ideRequest(
              "openUrl",
              "https://docs.continue.dev/reference/Model%20Providers/freetrial",
            )
          }
        >
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
      <Button
        className="w-full"
        disabled={!apiKey}
        onClick={() => {
          postToIde("config/addOpenAiKey", apiKey);
          dispatch(setShowDialog(false));
          dispatch(setDefaultModel({ title: "GPT-4" }));
        }}
      >
        Use my OpenAI API key
      </Button>
      <div className="text-center">— OR —</div>
      <GridDiv>
        <Button
          onClick={() => {
            dispatch(setShowDialog(false));
            postToIde("completeOnboarding", {
              mode: "localAfterFreeTrial",
            });
            navigate("/localOnboarding");
          }}
        >
          Use local model
        </Button>
        <Button
          onClick={() => {
            dispatch(setShowDialog(false));
            navigate("/models");
          }}
        >
          View all options
        </Button>
      </GridDiv>
    </div>
  );
}

export default SetupLocalOrKeyDialog;
