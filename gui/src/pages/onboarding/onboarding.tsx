import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { greenButtonColor } from "../../components";
import { postToIde } from "../../util/ide";
import { setLocalStorage } from "../../util/localStorage";
import { Div, StyledButton } from "./components";

function Onboarding() {
  const navigate = useNavigate();

  const [hovered1, setHovered1] = useState(false);
  const [hovered2, setHovered2] = useState(false);
  const [hovered3, setHovered3] = useState(false);

  const [selected, setSelected] = useState(-1);

  return (
    <div className="p-2 max-w-96 mt-16 mx-auto">
      <h1 className="text-center">Welcome to Continue</h1>
      <p className="text-center pb-2">
        Let's find the setup that works best for you
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
        <h3>🔒 Fully local</h3>
        <p>
          No code will leave your computer, but less powerful models are used.
          Works with Ollama, LM Studio and others.
        </p>
      </Div>
      {selected === 0 && (
        <p className="px-3">
          <b>Embeddings:</b> Local sentence-transformers model
          <br />
          <br />
          <b>Autocomplete:</b> Starcoder2 3b (manual setup with Ollama, LM
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
          Use the best available commercial models to index code and answer
          questions. Code is still only ever stored locally.
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
      {/* <p>
        <a href="https://continue.dev/docs/customization/overview">
          Read the docs
        </a>{" "}
        to learn more and fully customize Continue by opening config.json.
      </p> */}
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
          <a href="https://continue.dev/docs/customization/overview">
            Read the docs
          </a>{" "}
          to learn more and fully customize Continue by opening config.json.
          This can always be done later.
        </p>
      </Div>

      <br />
      <div className="flex">
        <StyledButton
          disabled={selected < 0}
          onClick={() => {
            postToIde("showTutorial", undefined);
            postToIde("completeOnboarding", {
              mode: ["local", "optimized", "custom"][selected] as any,
            });
            setLocalStorage("onboardingComplete", true);
            postToIde("index/forceReIndex", undefined);
            navigate("/");
          }}
        >
          Continue
        </StyledButton>
      </div>
    </div>
  );
}

export default Onboarding;
