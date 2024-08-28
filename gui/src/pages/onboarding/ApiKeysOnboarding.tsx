import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuickModelSetup from "../../components/modelSelection/quickSetup/QuickModelSetup";
import Toggle from "../../components/modelSelection/Toggle";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getLocalStorage } from "../../util/localStorage";
import DefaultModelConfigForm from "./DefaultModelConfigForm";
import { useCompleteOnboarding } from "./utils";

function ApiKeysOnboarding() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();

  const [isBestToggle, setIsBestToggle] = useState(true);

  const { completeOnboarding } = useCompleteOnboarding();

  return (
    <div className="p-8 overflow-y-scroll">
      <div>
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate(-1)}
          className="inline-block cursor-pointer"
        />
      </div>

      <div className="pb-4 text-center">
        <h1>Model setup</h1>
        <p>
          Choose between our default configuration that includes the best models
          available, or configure your own setup.
        </p>
      </div>

      <Toggle
        selected={isBestToggle}
        optionOne={"Best models"}
        optionTwo={"Configure your own"}
        onClick={() => {
          setIsBestToggle((prev) => !prev);
        }}
      />

      {isBestToggle && <DefaultModelConfigForm />}

      {!isBestToggle && (
        <QuickModelSetup
          onDone={() => {
            ideMessenger.post("showTutorial", undefined);

            if (getLocalStorage("signedInToGh")) {
              completeOnboarding();
            } else {
              navigate("/apiKeyAutocompleteOnboarding");
            }
          }}
        ></QuickModelSetup>
      )}
    </div>
  );
}

export default ApiKeysOnboarding;
