"use client";

import { useEffect } from "react";

export function ClientRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-black/40 dark:text-white/40">
        Redirecting...
      </p>
    </div>
  );
}
