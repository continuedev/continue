import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
export default function EditConfigAction() {
  const ideMessenger = useContext(IdeMessengerContext);
  return (
    <span
      onClick={() =>
        ideMessenger.post("config/openProfile", { profileId: undefined })
      }
      className="hover:underline"
    >
      Open configuration file
    </span>
  );
}
