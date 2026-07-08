import { useState, useContext, useCallback } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { isJetBrains } from "../util";

export default function useCopy(text: string | (() => string)) {
  const [copied, setCopied] = useState<boolean>(false);
  const ideMessenger = useContext(IdeMessengerContext);

  const copyText = useCallback(() => {
    const textVal = typeof text === "string" ? text : text();
    if (isJetBrains()) {
      ideMessenger.post("copyText", { text: textVal });
    } else {
      navigator.clipboard.writeText(textVal);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, ideMessenger]);

  return { copied, copyText };
}
