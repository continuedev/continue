import { useContext } from "react";
import { ButtonSubtext } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";

function AddModelButtonSubtext() {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <ButtonSubtext>
      This will update your{" "}
      <span
        className="underline cursor-pointer"
        onClick={() => ideMessenger.post("openConfigJson", undefined)}
      >
        config file
      </span>
    </ButtonSubtext>
  );
}

export default AddModelButtonSubtext;
