import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  greenButtonColor,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
} from "../components";
import { postToIde } from "../util/ide";
import { setLocalStorage } from "../util/localStorage";

const StyledButton = styled(Button)`
  margin-left: auto;
  background-color: ${vscButtonBackground};
  color: ${vscButtonForeground};
`;

const Div = styled.div<{
  color: string;
  disabled: boolean;
  hovered: boolean;
  selected: boolean;
}>`
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  transition: all 0.5s;
  padding-left: 16px;
  padding-right: 16px;

  ${(props) =>
    props.disabled
      ? `
    opacity: 0.5;
    `
      : props.hovered || props.selected
      ? `
    border: 1px solid ${props.color};
    background-color: ${props.color}22;
    cursor: pointer;`
      : ""}

  ${(props) =>
    props.selected
      ? `
    box-shadow: 0 0 4px 0px ${props.color};
    `
      : ""}
`;

function Onboarding() {
  const navigate = useNavigate();

  const [hovered1, setHovered1] = useState(false);
  const [hovered2, setHovered2] = useState(false);
  const [hovered3, setHovered3] = useState(false);

  const [selected, setSelected] = useState(-1);

  return (
    <div className="p-2 max-w-96 mt-16">
      <h1 className="text-center">Welcome to Continue!</h1>
      <p>
        Before getting started, let's find the setup that works best for you! If
        you're not sure, don't worry—you can always make changes by clicking the
        gear icon in the bottom right.
      </p>
      <Div
        color={greenButtonColor}
        disabled={false}
        selected={selected === 0}
        hovered={hovered1}
        onClick={() => {
          setSelected(0);
        }}
        onMouseEnter={() => setHovered1(true)}
        onMouseLeave={() => setHovered1(false)}
      >
        <h3>🔒 Fully Local</h3>
        <p>
          No code will leave your computer, but less powerful models are used.
          Works with Ollama, LM Studio and others.
        </p>
      </Div>
      {selected === 0 && (
        <p className="px-3">
          <b>Embeddings:</b> Local transformers.js model
          <br />
          <br />
          <b>Autocomplete:</b> Starcoder2-3b (manual setup with Ollama, LM
          Studio, etc.)
          <br />
          <br />
          <b>Chat:</b> Manual setup with Ollama, LM Studio, etc.
        </p>
      )}
      <br></br>
      <Div
        color={"#be841b"}
        disabled={false}
        selected={selected === 1}
        hovered={hovered2}
        onClick={() => {
          setSelected(1);
        }}
        onMouseEnter={() => setHovered2(true)}
        onMouseLeave={() => setHovered2(false)}
      >
        <h3>✨ Optimized</h3>
        <p>
          Use the best models available to index code and answer questions. Code
          is still only ever stored locally.
        </p>
      </Div>
      {selected === 1 && (
        <p className="px-3">
          <b>Embeddings:</b> Voyage Code 2
          <br />
          <br />
          <b>Autocomplete:</b> Starcoder 7b via Fireworks AI (free trial)
          <br />
          <br />
          <b>Chat:</b> GPT-4, Claude 3, and others (free trial)
        </p>
      )}
      <br></br>
      <p>
        Want more control?{" "}
        <a href="https://continue.dev/docs/customization/overview">
          Read the documentation
        </a>{" "}
        to learn more and fully customize Continue to meet your needs by opening
        config.json.
      </p>
      <Div
        color={"#1b84be"}
        disabled={false}
        selected={selected === 2}
        hovered={hovered3}
        onMouseEnter={() => setHovered3(true)}
        onMouseLeave={() => setHovered3(false)}
        onClick={() => {
          setSelected(2);
          postToIde("openConfigJson", undefined);
        }}
      >
        <h3>⚙️ Custom</h3>
        <p>
          Using the config.json file you can customize every aspect of Continue.
        </p>
      </Div>

      <br />
      <div className="flex">
        <StyledButton
          disabled={selected < 0}
          onClick={() => {
            postToIde("completeOnboarding", {
              mode: ["local", "optimized", "custom"][selected] as any,
            });
            setLocalStorage("onboardingComplete", true);
            navigate("/");
          }}
        >
          Get Started
        </StyledButton>
      </div>
    </div>
  );
}

export default Onboarding;
