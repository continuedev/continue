import { useContext } from "react";
import Alert from "../gui/Alert";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export const NotDiamondSubtext = () => {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className="mt-2">
      <Alert>
        <p className="font-bold text-sm m-0">
          How to use Not Diamond in Continue
        </p>
        <p className="m-0 mt-1">
          Add at least one API key. Then check the list of supported models{" "}
          <a href="https://docs.notdiamond.ai/docs/llm-models" target="_blank">
            here
          </a>{" "}
          and add them via Continue
          <span
            className="underline cursor-pointer"
            onClick={() => ideMessenger.post("openConfigJson", undefined)}
          >
            {" "} config file
          </span>
        </p>
      </Alert>
    </div>
  );
};
