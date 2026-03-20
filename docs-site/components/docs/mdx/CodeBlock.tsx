"use client";

import { useRef, useState } from "react";

// Hoisted static SVG elements to avoid recreation on every render (Rule 6.2)
const checkIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const copyIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export function CodeBlock({
  children,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = preRef.current?.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative">
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      {/* Overlay: inset matches pre's border (1px) so gradient fills to the edge */}
      <div className="absolute inset-[1px] pointer-events-none flex items-start justify-end rounded-[5px] overflow-hidden">
        <div
          className="pointer-events-auto flex items-start pt-2 pl-8"
          style={{
            background:
              "linear-gradient(to right, transparent, var(--docs-code-bg-solid) 40%)",
          }}
        >
          <button
            onClick={handleCopy}
            className="mr-2 p-1.5 rounded-md text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
            aria-label="Copy code"
          >
            {copied ? checkIcon : copyIcon}
          </button>
        </div>
      </div>
    </div>
  );
}
