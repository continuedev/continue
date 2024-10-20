import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { StyledActionButton, Input, Button, ButtonSubtext } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setShowDialog } from "../../../redux/slices/uiStateSlice";
import { useDispatch } from "react-redux";

interface JetBrainsFetchGitHubTokenDialogProps {
  onComplete: () => void;
}

const GITHUB_AUTH_URL =
  "https://github.com/settings/tokens/new?scopes=user:email&description=Continue%20Free%20Trial%20Token%20";

function JetBrainsFetchGitHubTokenDialog({
  onComplete,
}: JetBrainsFetchGitHubTokenDialogProps) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [jbGhAuthToken, setJbGhAuthToken] = useState("");
  const [hasClickedGitHubButton, setHasClickedGitHubButton] = useState(false);

  async function submitJetBrainsToken() {
    await ideMessenger.request("setGitHubAuthToken", {
      token: jbGhAuthToken,
    });
    dispatch(setShowDialog(false));
    onComplete();
  }

  function openGitHubTokenPage() {
    ideMessenger.post("openUrl", GITHUB_AUTH_URL);
    setHasClickedGitHubButton(true);
  }

  return (
    <div className="flex flex-col gap-3 p-8">
      <div className="text-center">
        <h1 className="my-0">Sign in with GitHub</h1>
        <p>
          Continue will request read access to your GitHub email so that we can
          prevent abuse of the free trial. If you prefer not to sign in, you can
          use Continue with your own API keys or local model.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {hasClickedGitHubButton ? (
          <div className="flex flex-col items-start">
            <label className="text-sm">Token</label>
            <Input
              className="flex-1"
              placeholder="Enter your GitHub token"
              value={jbGhAuthToken}
              onChange={(e) => setJbGhAuthToken(e.target.value)}
            />
          </div>
        ) : (
          <StyledActionButton onClick={openGitHubTokenPage}>
            <p className="text-sm">Get GitHub token</p>
            <ArrowTopRightOnSquareIcon width={24} height={24} />
          </StyledActionButton>
        )}

        <div>
          <Button
            onClick={submitJetBrainsToken}
            disabled={!jbGhAuthToken}
            className="mt-2 grid w-full grid-flow-col items-center gap-2"
          >
            Get started using our API keys
          </Button>
          <ButtonSubtext>
            Try 50 chat and 2k autocomplete requests
          </ButtonSubtext>
        </div>
      </div>
    </div>
  );
}

export default JetBrainsFetchGitHubTokenDialog;
