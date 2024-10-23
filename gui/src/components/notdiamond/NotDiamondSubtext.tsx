import { useContext } from "react";
import Alert from "../gui/Alert";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export const NotDiamondSubtext = () => {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className="mt-2">
      <Alert>
        <p className="font-bold text-sm m-0">Using Not Diamond in Continue</p>
        <p className="m-0 mt-1">
          Adding a provider API key will include all supported models in Not
          Diamond's routing requests. You can change this behavior in the{" "}
          <span
            className="underline cursor-pointer"
            onClick={() => ideMessenger.post("openConfigJson", undefined)}
          >
            Continue config file
          </span>
        </p>
        <p>
          See an example{" "}
          <a
            href="https://docs.notdiamond.ai/docs/openai-integration"
            target="_blank"
          >
            here
          </a>
          .
        </p>
      </Alert>
    </div>
  );
};
