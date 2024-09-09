import Alert from "../../gui/Alert";
import DefaultModelConfigForm from "../components/DefaultModelConfigForm";
import { useNavigate } from "react-router-dom";
import { OnboardingTab } from "./types";

function OnboardingBestTab({ onComplete }: OnboardingTab) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl">Model configuration</h1>
        <p className="text-base">
          Get started with our recommended configuration using the best models
          available
        </p>
      </div>

      <Alert>
        Have an API key from OpenAI or another provider?{" "}
        <a
          className="text-inherit underline cursor-pointer hover:text-inherit"
          onClick={() => navigate("/addModel")}
        >
          Click here
        </a>{" "}
        to visit our general model configuration page.
      </Alert>

      <DefaultModelConfigForm onComplete={onComplete} />
    </div>
  );
}

export default OnboardingBestTab;
