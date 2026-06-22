"use client";

import Link from "next/link";
import { resolveHref } from "@/lib/resolveHref";

export function CardGroup({
  cols = 2,
  children,
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };
  const colClass =
    colClasses[Math.min(cols, 4) as 1 | 2 | 3 | 4] || colClasses[2];

  return <div className={`my-6 grid gap-4 ${colClass}`}>{children}</div>;
}

export function Card({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <div
      className={`rounded-lg border border-black/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-white/5 h-full${href ? "transition-colors hover:border-black/[0.18] dark:hover:border-white/[0.18]" : ""}`}
    >
      {title && (
        <h3 className="!mt-0 mb-1 text-[15px] font-medium text-black/80 dark:text-white/80">
          {title}
        </h3>
      )}
      {children && (
        <div className="text-sm text-black/50 dark:text-white/50">
          {children}
        </div>
      )}
    </div>
  );

  const resolve = resolveHref;

  if (href) {
    const isExternal = href.startsWith("http");

    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="!text-inherit no-underline"
        >
          {inner}
        </a>
      );
    }

    const internalPath = href.startsWith("/docs") ? href : `/docs${href}`;
    const resolved = resolve(internalPath);

    return (
      <Link href={resolved} className="!text-inherit no-underline">
        {inner}
      </Link>
    );
  }

  return inner;
}
