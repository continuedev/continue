import { useEffect } from "react";
import { useAppSelector } from "../redux/hooks";

/**
 * Shihuo Telemetry Provider for GUI
 * This component handles Shihuo telemetry initialization and management
 */
export default function ShihuoTelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowAnonymousTelemetry = useAppSelector(
    (store) => store?.config?.config?.allowAnonymousTelemetry,
  );

  useEffect(() => {
    if (allowAnonymousTelemetry) {
      // Initialize Shihuo telemetry for GUI
      // The core telemetry service will be initialized automatically
      // when the main Telemetry.setup() is called
      console.log("Shihuo telemetry enabled for GUI");
    } else {
      console.log("Shihuo telemetry disabled for GUI");
    }
  }, [allowAnonymousTelemetry]);

  return <>{children}</>;
}
