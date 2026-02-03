import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

/* Documentation unavailable in air-gapped mode */
export default function PostHogPageView() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;

      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }

      posthog.capture("$pageview", {
        $current_url: url,
        pathname,
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
