import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useWebviewListener } from "./useWebviewListener";

export type TokenUsageDisplayMode = "never" | "history" | "session" | "turn";

export function useTokenUsageSetting(): TokenUsageDisplayMode {
  const ideMessenger = useContext(IdeMessengerContext);
  const [mode, setMode] = useState<TokenUsageDisplayMode>("never");

  useEffect(() => {
    let mounted = true;
    void ideMessenger.ide.getIdeSettings().then((settings) => {
      if (!mounted) {
        return;
      }
      setMode((settings.showTokenUsage ?? "never") as TokenUsageDisplayMode);
    });
    return () => {
      mounted = false;
    };
  }, [ideMessenger]);

  useWebviewListener(
    "ideSettingsUpdate",
    async (settings) => {
      setMode((settings.showTokenUsage ?? "never") as TokenUsageDisplayMode);
    },
    [],
  );

  return mode;
}
