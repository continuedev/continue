import { useState, useEffect, useContext } from "react";
import { isJetBrains } from "../util";
import { useWebviewListener } from "./useWebviewListener";
import { IdeMessengerContext } from "../context/IdeMessenger";

export default function useIsOSREnabled() {
  const [isOSREnabled, setIsOSREnabled] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(() => {
    if (isJetBrains()) {
      (async () => {
        await ideMessenger
          .request("jetbrains/isOSREnabled", undefined)
          .then((result) => {
            if (result.status === "success") {
              setIsOSREnabled(result.content);
            }
          });
      })();
    }
  }, [ideMessenger]);

  return isOSREnabled;
}
