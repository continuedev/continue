import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  SecondaryButton,
  greenButtonColor,
  vscForeground,
} from "../../components";
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

  const [jbGhAuthToken, setJbGhAuthToken] = useState("");

  return (
    <div className="p-2 max-w-96 mt-16 mx-auto">
      <h1 className="text-center">Welcome to Continue</h1>
      <p className="text-center pb-2">
        Let's find the setup that works best for you
      </p>
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

      {getLocalStorage("onboardingComplete") && (
        <>
          <hr className="w-full my-12"></hr>

          <p className="text-center">
            OR sign in with GitHub to try 25 free requests
          </p>
          {isJetBrains() ? (
            <div className="text-center">
              <div className="flex justify-center">
                <SecondaryButton
                  onClick={() => {
                    ideMessenger.post(
                      "openUrl",
                      "https://github.com/settings/tokens/new?scopes=user:email&description=Continue%20Free%20Trial%20Token%20",
                    );
                  }}
                  className="grid grid-flow-col items-center gap-2"
                >
                  <svg
                    viewBox="0 0 98 96"
                    height={24}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                      fill={vscForeground}
                    />
                  </svg>
                  Generate Token
                </SecondaryButton>
              </div>
              <Input
                placeholder="Paste token here"
                value={jbGhAuthToken}
                onChange={(e) => setJbGhAuthToken(e.target.value)}
              />
              <Button
                disabled={!jbGhAuthToken}
                onClick={async () => {
                  await ideMessenger.request("setGitHubAuthToken", {
                    token: jbGhAuthToken,
                  });
                  setLocalStorage("onboardingComplete", true);
                  navigate("/");
                }}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <SecondaryButton
                onClick={async () => {
                  await ideMessenger.request("getGitHubAuthToken", undefined);
                  setLocalStorage("onboardingComplete", true);
                  await ideMessenger.request("completeOnboarding", {
                    mode: "freeTrial",
                  });
                  navigate("/");
                }}
                className="grid grid-flow-col items-center gap-2"
              >
                <svg
                  viewBox="0 0 98 96"
                  height={24}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                    fill={vscForeground}
                  />
                </svg>
                Sign in with GitHub
              </SecondaryButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Onboarding;
