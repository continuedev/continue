import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import QuickModelSetup from "../../components/modelSelection/quickSetup/QuickModelSetup";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getLocalStorage } from "../../util/localStorage";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

function ApiKeyOnboarding() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();

  return (
    <div className="p-2 max-w-96 mt-8 mx-auto">
      <div>
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate(-1)}
          className="inline-block cursor-pointer"
        />
      </div>

      <h1 className="text-center">Model Setup</h1>
      <p className="text-center">
        To get started, choose a model and enter your API key.
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
