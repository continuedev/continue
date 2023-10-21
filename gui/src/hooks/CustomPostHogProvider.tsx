import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { PropsWithChildren, useEffect } from "react";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import React from "react";

const CustomPostHogProvider = ({ children }: PropsWithChildren) => {
  const allowAnonymousTelemetry = useSelector(
    (store: RootStore) => store?.serverState?.config?.allow_anonymous_telemetry
  );

  const [client, setClient] = React.useState<any>(undefined);

  useEffect(() => {
    if (allowAnonymousTelemetry) {
      posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
        api_host: "https://app.posthog.com",
        disable_session_recording: true,
      });
      setClient(client);
    } else {
      setClient(undefined);
    }
  }, [allowAnonymousTelemetry]);

  return allowAnonymousTelemetry ? (
    <PostHogProvider client={client}>{children}</PostHogProvider>
  ) : (
    <>{children}</>
  );
};

export default CustomPostHogProvider;
