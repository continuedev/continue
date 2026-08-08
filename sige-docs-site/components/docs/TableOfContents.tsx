"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/docs";

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden w-56 flex-shrink-0 overflow-y-auto px-4 pb-8 pt-8 xl:block">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-black/30 dark:text-white/30">
        On this page
      </h4>
      <nav className="space-y-1">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`block py-1 text-[13px] transition-colors ${
              heading.level === 3 ? "pl-3" : heading.level === 4 ? "pl-6" : ""
            } ${
              activeId === heading.id
                ? "font-medium text-black/80 dark:text-white/80"
                : "text-black/35 hover:text-black/60 dark:text-white/35 dark:hover:text-white/60"
            }`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
