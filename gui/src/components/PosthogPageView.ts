import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { useSearchParams, useLocation } from "react-router-dom";

/**
 * This is copied from here: https://posthog.com/tutorials/single-page-app-pageviews#tracking-pageviews-in-nextjs-app-router
 * They don't have a non-NextJS doc for React apps.
 */
export default function PostHogPageView() {
  const { pathname } = useLocation();
  const searchParams = useSearchParams();
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
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
