import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { greenButtonColor } from "../../components";
import StyledMarkdownPreview from "../../components/markdown/StyledMarkdownPreview";
import { postToIde } from "../../util/ide";
import { setLocalStorage } from "../../util/localStorage";
import { Div, StyledButton } from "./components";

const TopDiv = styled.div`
  overflow-y: scroll;

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }

  height: 100%;
`;

function ExistingUserOnboarding() {
  const navigate = useNavigate();

  const [hovered1, setHovered1] = useState(false);
  const [hovered2, setHovered2] = useState(false);

  const [selected, setSelected] = useState(-1);

  return (
    <TopDiv>
      <div className="m-auto p-2 max-w-96 mt-16 overflow-y-scroll">
        <h1 className="text-center">Use Improved Models?</h1>
        <p className="text-center pb-2">
          Continue now integrates with higher quality models for autocomplete
          and codebase retrieval.
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
          <h3>🔒 Keep existing setup</h3>
          <p>
            Continue using fully local autocomplete + embeddings, or whichever
            options you have configured.
          </p>
        </Div>
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
          <h3>✨ Use optimized models</h3>
          <p>
            Continue's autocomplete and codebase retrieval will feel
            significantly improved. API calls are made to Fireworks/Voyage, but
            code is only ever stored locally.
          </p>
        </Div>
        {selected === 1 && (
          <>
            <StyledMarkdownPreview
              source={`The following will be written to \`config.json\`:
\`\`\`json
{
  // Starcoder 7b on Fireworks AI
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete",
    "provider": "free-trial",
    "model": "starcoder-7b"
  },
  // Voyage AI's voyage-code-2
  "embeddingsProvider": {
    "provider": "free-trial"
  },
  // Voyage AI's rerank-lite-1
  "reranker": {
    "name": "free-trial"
  }
}
\`\`\`

Alternatively, you can enter your own API keys:
\`\`\`json
{
  "tabAutocompleteModel": {
    "title": "Starcoder 2",
    "provider": "openai",
    "model": "accounts/fireworks/models/starcoder-7b",
    "apiBase": "https://api.fireworks.ai/inference/v1",
    "apiKey": "FIREWORKS_API_KEY"
  }
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1",
    "apiKey": "VOYAGE_API_KEY"
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "apiKey": "VOYAGE_API_KEY"
    }
  }
}
\`\`\``}
            ></StyledMarkdownPreview>
          </>
        )}
        <br />
        <div className="flex">
          <StyledButton
            disabled={selected < 0}
            onClick={() => {
              postToIde("completeOnboarding", {
                mode: ["localExistingUser", "optimizedExistingUser"][
                  selected
                ] as any,
              });
              postToIde("openConfigJson", undefined);
              setLocalStorage("onboardingComplete", true);
              postToIde("index/forceReIndex", undefined);
              navigate("/");
            }}
          >
            Continue
          </StyledButton>
        </div>
      </div>
    </TopDiv>
  );
}

export default ExistingUserOnboarding;
