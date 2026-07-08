"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPageButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Copy the visible page content
    const content = document.querySelector(".docs-content");
    if (content) {
      await navigator.clipboard.writeText(content.textContent || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[13px] text-black/35 transition-colors hover:bg-black/[0.04] hover:text-black/60 dark:text-white/35 dark:hover:bg-white/[0.04] dark:hover:text-white/60"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span>{copied ? "Copied" : "Copy page"}</span>
    </button>
  );
}
