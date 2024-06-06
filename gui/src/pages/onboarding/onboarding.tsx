import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { greenButtonColor } from "../../components";
import { ftl } from "../../components/dialogs/FTCDialog";
import GitHubSignInButton from "../../components/modelSelection/quickSetup/GitHubSignInButton";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { Div, StyledButton } from "./components";

function Onboarding() {
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [hovered0, setHovered0] = useState(false);
  const [hovered1, setHovered1] = useState(false);

  const [selected, setSelected] = useState(-1);

  useEffect(() => {
    setLocalStorage("onboardingComplete", true);
  }, []);

  return (
    <div className="p-2 max-w-96 mt-16 mx-auto">
      {getLocalStorage("ftc") > ftl() ? (
        <>
          <h1 className="text-center">Free trial limit reached</h1>
          <p className="text-center pb-2">
            To keep using Continue, please enter an API key or set up a local
            model
          </p>
        </>
      ) : (
        <>
          <h1 className="text-center">Welcome to Continue</h1>
          <p className="text-center pb-2">
            Let's find the setup that works best for you
          </p>
        </>
      )}

      <Div
        color={"#be841b"}
        disabled={false}
        selected={selected === 0}
        hovered={hovered0}
        onClick={() => {
          setSelected(0);
        }}
        onMouseEnter={() => setHovered0(true)}
        onMouseLeave={() => setHovered0(false)}
      >
        <h3>✨ Use your API key</h3>
        <p>
          Enter an OpenAI or other API key for the best experience. Continue
          will use the best available commercial models to index code. Code is
          only ever stored locally.
        </p>
      </Div>
      {selected === 0 && (
        <p className="px-3">
          <b>Chat:</b> Whichever model you choose
          <br />
          <br />
          <b>Embeddings:</b> Voyage Code 2
          <br />
          <br />
          <b>Autocomplete:</b> Starcoder 7B via Fireworks AI
        </p>
      )}
      <br></br>
      <Div
        color={greenButtonColor}
        disabled={false}
        selected={selected === 1}
        hovered={hovered1}
        onClick={() => {
          setSelected(1);
        }}
        onMouseEnter={() => setHovered1(true)}
        onMouseLeave={() => setHovered1(false)}
      >
        <h3>🔒 Local models</h3>
        <p>
          No code will leave your computer, but less powerful models are used.
          Works with Ollama, LM Studio and others.
        </p>
      </Div>
      {selected === 1 && (
        <p className="px-3">
          <b>Chat:</b> Llama 3 with Ollama, LM Studio, etc.
          <br />
          <br />
          <b>Embeddings:</b> Nomic Embed
          <br />
          <br />
          <b>Autocomplete:</b> Starcoder2 3B
        </p>
      )}
      <br></br>
      <br />
      <div className="flex">
        <StyledButton
          blurColor={
            selected === 0
              ? "#be841b"
              : selected === 1
                ? greenButtonColor
                : "#1b84be"
          }
          disabled={selected < 0}
          onClick={() => {
            ideMessenger.post("completeOnboarding", {
              mode: ["apiKeys", "local"][selected] as any,
            });
            setLocalStorage("onboardingComplete", true);

            if (selected === 1) {
              navigate("/localOnboarding");
            } else {
              // Only needed when we switch from the default (local) embeddings provider
              ideMessenger.post("index/forceReIndex", undefined);
              navigate("/apiKeyOnboarding");
            }
          }}
        >
          Continue
        </StyledButton>
      </div>

      {(!getLocalStorage("onboardingComplete") || isJetBrains()) && (
        <>
          <hr className="w-full my-12"></hr>

          <p className="text-center">
            OR sign in with GitHub to try 25 free requests
          </p>
          <GitHubSignInButton
            onComplete={async (token) => {
              setLocalStorage("onboardingComplete", true);
              await ideMessenger.request("completeOnboarding", {
                mode: "freeTrial",
              });
              navigate("/");
            }}
          ></GitHubSignInButton>
        </>
      )}
    </div>
  );
}

export default Onboarding;
