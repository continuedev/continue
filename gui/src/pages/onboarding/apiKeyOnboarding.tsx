import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import QuickModelSetup from "../../components/modelSelection/quickSetup/QuickModelSetup";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getLocalStorage } from "../../util/localStorage";

function ApiKeyOnboarding() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  return (
    <div className="p-2 max-w-96 mt-16 mx-auto">
      <h1 className="text-center">Model Setup</h1>
      <p className="text-center">
        To get started, choose a model and enter your API key. You can always
        reconfigure later by clicking the{" "}
        <Cog6ToothIcon
          className="inline-block h-5 w-5 align-middle cursor-pointer"
          onClick={() => ideMessenger.post("openConfigJson", undefined)}
        />{" "}
        icon in the bottom right.
      </p>

      <QuickModelSetup
        onDone={() => {
          ideMessenger.post("showTutorial", undefined);

          if (getLocalStorage("signedInToGh") === true) {
            navigate("/");
          } else {
            navigate("/apiKeyAutocompleteOnboarding");
          }
        }}
      ></QuickModelSetup>
    </div>
  );
}

export default ApiKeyOnboarding;
