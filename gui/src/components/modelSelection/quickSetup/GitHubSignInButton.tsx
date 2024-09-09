import { useContext, useState } from "react";
import {
  Button,
  Input,
  lightGray,
  SecondaryButton,
  vscForeground,
} from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";
import { setLocalStorage } from "../../../util/localStorage";
import styled from "styled-components";

interface GitHubSignInButtonProps {
  onComplete: (token: string) => void;
}

const ButtonSubtext = styled.p`
  margin-top: 0;
  text-align: center;
  color: ${lightGray};
`;

function GitHubSignInButton(props: GitHubSignInButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [jbGhAuthToken, setJbGhAuthToken] = useState("");

  return isJetBrains() ? (
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
          Get started using our API keys
        </SecondaryButton>
        <ButtonSubtext>You'll receive 50 requests for free</ButtonSubtext>
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
          setLocalStorage("signedInToGh", true);
          props.onComplete(jbGhAuthToken);
        }}
      >
        Continue
      </Button>
    </div>
  ) : (
    <div className="mt-4 w-full">
      <Button
        onClick={async () => {
          const result = await ideMessenger.request(
            "getGitHubAuthToken",
            undefined,
          );
          if (result.status === "success") {
            setLocalStorage("signedInToGh", true);
            props.onComplete(result.content);
          }
        }}
        className="grid grid-flow-col items-center gap-2"
      >
        Get started using our API keys
      </Button>
      <ButtonSubtext>You'll receive 50 requests for free</ButtonSubtext>
    </div>
  );
}

export default GitHubSignInButton;
