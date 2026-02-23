import * as Sentry from "@sentry/react";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import {
  anonymizeSentryEvent,
  anonymizeUserInfo,
} from "core/util/sentry/anonymization";
import { SENTRY_DSN } from "core/util/sentry/constants";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "../context/Auth";
import { useAppSelector } from "../redux/hooks";
import { isPrerelease } from "../util/index";
import { isContinueTeamMember } from "../util/isContinueTeamMember";
import { getLocalStorage } from "../util/localStorage";

const SAMPLE_REATE = 0.1;
const TRACES_SAMPLE_RATE = 0.25;

const TelemetryProviders = ({ children }: PropsWithChildren) => {
  const allowAnonymousTelemetry = useAppSelector(
    (store) => store?.config?.config?.allowAnonymousTelemetry,
  );
  const { session } = useAuth();

  // TODO: Remove Continue team member check once Sentry is ready for all users
  const hasContinueEmail = isContinueTeamMember(
    (session as HubSessionInfo)?.account?.id,
  );

  useEffect(() => {
    // PostHog depends only on allowAnonymousTelemetry
    if (allowAnonymousTelemetry) {
      // Initialize PostHog (existing logic)
      posthog.init("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
        api_host: "https://app.posthog.com",
        disable_session_recording: true,
        autocapture: false,
        // We need to manually track pageviews since we're a SPA
        capture_pageleave: false,
        capture_pageview: false,
      });
      posthog.identify(window.vscMachineId);
      posthog.opt_in_capturing();
    } else {
      // Disable PostHog
      posthog.opt_out_capturing();
    }

    // Sentry depends on both allowAnonymousTelemetry and hasContinueEmail
    if (allowAnonymousTelemetry && hasContinueEmail) {
      // Initialize Sentry (new for GUI - enhanced React setup)
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV,
        integrations: [
          // Performance monitoring
          Sentry.browserTracingIntegration(),
        ],

        // For basic error tracking, a lower sample rate should be fine
        sampleRate: SAMPLE_REATE,
        tracesSampleRate: TRACES_SAMPLE_RATE,

        // Privacy-conscious default
        sendDefaultPii: false,

        // Strip sensitive data and add basic properties
        beforeSend(event: Sentry.Event) {
          // Apply comprehensive anonymization using shared logic
          const anonymizedEvent = anonymizeSentryEvent(event);
          if (!anonymizedEvent) return null;

          // Add basic properties available in GUI environment
          if (!anonymizedEvent.tags) anonymizedEvent.tags = {};

          // Add environment information
          anonymizedEvent.tags.environment = process.env.NODE_ENV;

          // Add ideInfo properties spread out as top-level properties (like PostHog)
          const extensionVersion = getLocalStorage("extensionVersion");
          const ideType = getLocalStorage("ide");

          if (extensionVersion) {
            anonymizedEvent.tags.extensionVersion = extensionVersion;
          }

          if (ideType) {
            anonymizedEvent.tags.ideType = ideType;
          }

          // Add isPrerelease information
          anonymizedEvent.tags.isPrerelease = isPrerelease();

          return anonymizedEvent;
        },
      });

      // Set anonymized user context for Sentry
      const anonymizedUser = anonymizeUserInfo({
        id: window.vscMachineId || "anonymous",
      });
      Sentry.setUser(anonymizedUser);
    } else {
      // Disable Sentry properly - close the client to stop all network requests
      try {
        const client = Sentry.getClient();
        if (client) {
          client.close();
        }
        Sentry.getCurrentScope().clear();
      } catch (error) {
        console.error("Error disabling Sentry:", error);
      }
    }
  }, [allowAnonymousTelemetry, hasContinueEmail]);

  // Conditionally wrap with ErrorBoundary when telemetry is enabled and user is Continue team member
  const content =
    allowAnonymousTelemetry && hasContinueEmail ? (
      <Sentry.ErrorBoundary showDialog={false}>{children}</Sentry.ErrorBoundary>
    ) : (
      children
    );

  // Only PostHog needs a provider wrapper - Sentry works globally once initialized
  return <PostHogProvider client={posthog}>{content}</PostHogProvider>;
};

export default TelemetryProviders;
