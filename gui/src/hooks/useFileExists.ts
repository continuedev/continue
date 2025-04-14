import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useIdeMessengerRequest } from "./useIdeMessengerRequest";

/**
 * Wrapper around useIdeMessengerRequest specifically for checking file existence.
 * We maintain this as a separate hook because the conversion from relative filepath
 * to URI requires an async call.
 */
export function useFileExists(filepath?: string) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  const { result: fileExists, refresh: refreshFileExists } =
    useIdeMessengerRequest(
      "fileExists",
      resolvedUri ? { filepath: resolvedUri } : null,
    );

  useEffect(() => {
    async function resolveUri() {
      if (!filepath) {
        setResolvedUri(null);
        return;
      }

      try {
        const uri = await inferResolvedUriFromRelativePath(
          filepath,
          ideMessenger.ide,
        );
        setResolvedUri(uri);
      } catch (err) {
        console.error("Failed to resolve URI:", err);
      }
    }

    resolveUri();
  }, [filepath, ideMessenger.ide]);

  console.log({ fileExists, resolvedUri });

  return { fileExists, refreshFileExists };
}
