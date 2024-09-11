import { useContext, useState } from "react";
import { Button, ButtonSubtext, Divider, Input, SecondaryButton } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";
import { setLocalStorage } from "../../../util/localStorage";

interface QuickstartSubmitButtonProps {
  onComplete: (token: string) => void;
}

function QuickstartSubmitButton({ onComplete }: QuickstartSubmitButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [jbGhAuthToken, setJbGhAuthToken] = useState("");
  const [showJetBrainsInput, setShowJetBrainsInput] = useState(false);

  const handleTokenAcquisition = async (token: string) => {
    setLocalStorage("signedInToGh", true);
    onComplete(token);
  };

  const openGitHubTokenPage = () => {
    ideMessenger.post(
      "openUrl",
      "https://github.com/settings/tokens/new?scopes=user:email&description=Continue%20Free%20Trial%20Token%20",
    );
  };

  const getGitHubAuthToken = async () => {
    if (isJetBrains()) {
      setShowJetBrainsInput(true);
    } else {
      const result = await ideMessenger.request(
        "getGitHubAuthToken",
        undefined,
      );
      if (result.status === "success") {
        handleTokenAcquisition(result.content);
      }
    }
  };

  const submitJetBrainsToken = async () => {
    await ideMessenger.request("setGitHubAuthToken", { token: jbGhAuthToken });
    handleTokenAcquisition(jbGhAuthToken);
  };

  return (
    <div className="mt-4 w-full">
      <Button
        onClick={getGitHubAuthToken}
        className="grid grid-flow-col items-center gap-2 w-full"
      >
        Get started using our API keys
      </Button>
      <ButtonSubtext>Try 50 chat and 2k autocomplete requests</ButtonSubtext>

      {showJetBrainsInput && isJetBrains() && (
        <>
          <Divider className="my-8" />

          <div className="flex justify-center mb-2">
            <SecondaryButton onClick={openGitHubTokenPage}>
              Get GitHub Token
            </SecondaryButton>
          </div>
          <Input
            placeholder="Paste token here"
            value={jbGhAuthToken}
            onChange={(e) => setJbGhAuthToken(e.target.value)}
          />
          <Button
            onClick={submitJetBrainsToken}
            disabled={!jbGhAuthToken}
            className="grid grid-flow-col items-center gap-2 w-full mt-2"
          >
            Submit Token
          </Button>
        </>
      )}
    </div>
  );
}

export default QuickstartSubmitButton;
