import { useState, useEffect, useContext } from "react";
import { isJetBrains } from "../util";
import { useWebviewListener } from "./useWebviewListener";
import { IdeMessengerContext } from "../context/IdeMessenger";

export default function useIsOSREnabled() {
  const [isOSREnabled, setIsOSREnabled] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  useWebviewListener("jetbrains/isOSREnabled", async (isOSREnabled) => {
    setIsOSREnabled(isOSREnabled);
  });

  useEffect(() => {
    if (isJetBrains()) {
      ideMessenger.post("jetbrains/isOSREnabled", undefined);
    }
  }, []);

  return isOSREnabled;
}
