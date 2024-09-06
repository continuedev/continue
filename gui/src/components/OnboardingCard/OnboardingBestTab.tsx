import Alert from "../gui/Alert";
import DefaultModelConfigForm from "./DefaultModelConfigForm";

function OnboardingBestTab() {
  return (
    <div>
      <Alert>
        Have an API key from OpenAI or another provider?{" "}
        {/* TODO: Configure link */}
        <a className="text-inherit underline cursor-pointer hover:text-inherit">
          Click here
        </a>{" "}
        to visit our general model configuration page.
      </Alert>

      <DefaultModelConfigForm />
    </div>
  );
}

export default OnboardingBestTab;
