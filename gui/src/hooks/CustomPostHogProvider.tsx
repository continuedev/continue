import React, { PropsWithChildren, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";

const CustomPostHogProvider = ({ children }: PropsWithChildren) => {
  const allowAnonymousTelemetry = useSelector(
    (store: RootState) => store?.state?.config.allowAnonymousTelemetry,
  );

  const [client, setClient] = React.useState<any>(undefined);

  useEffect(() => {
    /* In addition to setting default to false in config, we also disable telemetry code to protected tented code
    if (allowAnonymousTelemetry) {
      posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
        api_host: "https://app.posthog.com",
        disable_session_recording: true,
        // // We need to manually track pageviews since we're a SPA
        capture_pageview: false,
      });
      posthog.identify(window.vscMachineId);
      posthog.opt_in_capturing();
      setClient(client);
      
    } else {
      setClient(undefined);
    }
    */

    setClient(undefined);
  }, [allowAnonymousTelemetry]);

  return (
    <>{children}</>
  );
};

export default CustomPostHogProvider;
