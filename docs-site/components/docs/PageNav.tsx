"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveHref } from "@/lib/resolveHref";

export function PageNav({
  prev,
  next,
}: {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}) {
  if (!prev && !next) return null;

  return (
    <div className="flex justify-between items-center mt-16 pt-6 border-t border-black/[0.06] dark:border-white/[0.06]">
      {prev ? (
        <Link
          href={resolveHref(`/docs/${prev.slug}`)}
          className="flex items-center gap-2 text-sm text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors no-underline"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={resolveHref(`/docs/${next.slug}`)}
          className="flex items-center gap-2 text-sm text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors no-underline"
        >
          <span>{next.title}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
