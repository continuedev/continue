"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { type NavGroup, type NavItem, type NavTab } from "@/config/docsNav";
import { TableOfContents } from "./TableOfContents";
import { DocsSearch } from "./DocsSearch";
import { resolveHref } from "@/lib/resolveHref";
import { withBasePath } from "@/lib/basePath";
import type { Heading } from "@/lib/docs";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function containsSlug(group: NavGroup, slug: string): boolean {
  return group.pages.some((item) => {
    if (typeof item === "string") return item === slug;
    return containsSlug(item, slug);
  });
}

function findActiveTab(nav: NavTab[], slug: string) {
  for (const tab of nav) {
    for (const group of tab.groups) {
      if (containsSlug(group, slug)) {
        return tab;
      }
    }
  }
  return nav[0];
}

function slugToLabel(slug: string, titleMap?: Record<string, string>) {
  if (titleMap?.[slug]) return titleMap[slug];
  const name = slug.split("/").pop() || slug;
  return name
    .replace(/^\d+-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Top nav constants                                                  */
/* ------------------------------------------------------------------ */

const NAV_LINK_DEFS = [
  { label: "Docs", path: "/docs" },
  { label: "Blog", path: "/blog" },
];

const NAV_LINKS = NAV_LINK_DEFS.map((d) => ({
  label: d.label,
  href: resolveHref(d.path),
}));

const NAV_LINK_CLASSES =
  "text-[13px] text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors tracking-wide uppercase font-mono";

const SIDEBAR_W = "w-64"; // shared sidebar width token

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 text-black/40 transition-colors hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar primitives                                                 */
/* ------------------------------------------------------------------ */

function SidebarGroup({
  group,
  currentSlug,
  titleMap,
  resolve,
  depth = 0,
}: {
  group: NavGroup;
  currentSlug: string;
  titleMap?: Record<string, string>;
  resolve: (path: string) => string;
  depth?: number;
}) {
  const isActive = containsSlug(group, currentSlug);
  const [open, setOpen] = useState(group.expanded === true || isActive);

  // Top-level groups are static section headers (always open, not toggleable)
  if (depth === 0) {
    return (
      <div>
        <div className="py-2 text-[11px] font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
          {group.group}
        </div>
        <div className="space-y-0.5">
          {group.pages.map((item, i) => (
            <SidebarItem
              key={i}
              item={item}
              currentSlug={currentSlug}
              titleMap={titleMap}
              resolve={resolve}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="-mx-2.5 flex w-full items-center justify-between px-2.5 py-1.5 text-[13px] text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70"
      >
        <span>{group.group}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-black/30 transition-transform dark:text-white/30 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="ml-3 space-y-0.5 border-l border-black/[0.06] pl-3 dark:border-white/[0.06]">
          {group.pages.map((item, i) => (
            <SidebarItem
              key={i}
              item={item}
              currentSlug={currentSlug}
              titleMap={titleMap}
              resolve={resolve}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  item,
  currentSlug,
  titleMap,
  resolve,
  depth = 0,
}: {
  item: NavItem;
  currentSlug: string;
  titleMap?: Record<string, string>;
  resolve: (path: string) => string;
  depth?: number;
}) {
  if (typeof item === "string") {
    const isActive = item === currentSlug;
    return (
      <Link
        href={resolve(`/docs/${item}`)}
        className={`-mx-2.5 block rounded px-2.5 py-1.5 text-[13px] no-underline transition-colors ${
          isActive
            ? "bg-black/[0.04] font-medium text-black/90 dark:bg-white/[0.06] dark:text-white/90"
            : "text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70"
        }`}
      >
        {slugToLabel(item, titleMap)}
      </Link>
    );
  }

  return (
    <SidebarGroup
      group={item}
      currentSlug={currentSlug}
      titleMap={titleMap}
      resolve={resolve}
      depth={depth}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main shell                                                         */
/* ------------------------------------------------------------------ */

export function DocsShell({
  currentSlug,
  headings,
  titleMap,
  docsNav,
  children,
}: {
  currentSlug: string;
  headings: Heading[];
  titleMap?: Record<string, string>;
  docsNav: NavTab[];
  children: React.ReactNode;
}) {
  const activeTab = findActiveTab(docsNav, currentSlug) ?? docsNav[0]!;
  const [selectedTab, setSelectedTab] = useState(activeTab.tab);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentTab = docsNav.find((t) => t.tab === selectedTab) ?? docsNav[0]!;
  const navLinks = NAV_LINKS;

  return (
    <div className="flex h-full flex-col">
      {/* ---- Header: nav + tabs ---- */}
      <div className="z-30 flex-shrink-0 bg-white dark:bg-[#0a0a0a]">
        {/* Top nav bar */}
        <nav className="border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="mx-auto flex max-w-[90rem] items-center">
            {/* Logo — same width & padding as sidebar */}
            <div
              className={`hidden items-center lg:flex ${SIDEBAR_W} flex-shrink-0 px-5 py-3`}
            >
              <Link href={resolveHref("/")} className="flex items-center">
                <img
                  src={withBasePath("/images/continue-logo-light.png")}
                  alt="Continue"
                  className="h-8 w-auto dark:invert"
                />
              </Link>
            </div>
            {/* Mobile logo */}
            <div className="flex items-center px-5 py-3 lg:hidden">
              <Link href={resolveHref("/")} className="flex items-center">
                <img
                  src={withBasePath("/images/continue-logo-light.png")}
                  alt="Continue"
                  className="h-8 w-auto dark:invert"
                />
              </Link>
            </div>
            {/* Centered search */}
            <div className="flex flex-1 items-center justify-center px-5 py-3">
              <DocsSearch resolve={resolveHref} />
            </div>
            {/* Right nav */}
            <div className="flex items-center gap-6 px-5 py-3">
              <div className="hidden items-center gap-6 md:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`${NAV_LINK_CLASSES} ${
                      link.label === "Docs"
                        ? "text-black/70 dark:text-white/70"
                        : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link href={resolveHref("/login")} className={NAV_LINK_CLASSES}>
                  Sign in
                </Link>
              </div>
              <ThemeToggle />
              {/* Mobile menu button */}
              <button
                className="p-2 text-black/40 transition-colors hover:text-black/70 md:hidden dark:text-white/40 dark:hover:text-white/70"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="flex flex-col gap-4 px-5 pb-2 pt-4 md:hidden">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={NAV_LINK_CLASSES}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={resolveHref("/login")}
                className={NAV_LINK_CLASSES}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
            </div>
          )}
        </nav>

        {/* Tab bar — aligned with sidebar */}
        <div className="border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="mx-auto flex max-w-[90rem] gap-6 px-5">
            {docsNav.map((tab) => (
              <button
                key={tab.tab}
                onClick={() => setSelectedTab(tab.tab)}
                className={`relative py-2.5 text-sm font-medium transition-colors ${
                  selectedTab === tab.tab
                    ? "text-black/80 dark:text-white/80"
                    : "text-black/35 hover:text-black/60 dark:text-white/35 dark:hover:text-white/60"
                }`}
              >
                {tab.tab}
                {selectedTab === tab.tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-black/70 dark:bg-white/70" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Content area ---- */}
      <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1">
        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:block ${SIDEBAR_W} flex-shrink-0 overflow-y-auto border-r border-black/[0.06] px-5 pb-8 pt-5 dark:border-white/[0.06]`}
        >
          <nav className="space-y-5">
            {currentTab.groups.map((group, i) => (
              <SidebarGroup
                key={i}
                group={group}
                currentSlug={currentSlug}
                titleMap={titleMap}
                resolve={resolveHref}
              />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 pb-8 pt-10 lg:px-20">
          {children}
        </main>

        {/* Table of contents */}
        <TableOfContents headings={headings} />
      </div>

      {/* ---- Mobile sidebar ---- */}
      <button
        className="fixed bottom-4 left-4 z-50 rounded-full bg-black/80 p-3 text-white shadow-lg lg:hidden dark:bg-white/80 dark:text-black"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 lg:hidden dark:bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r border-black/[0.06] bg-white px-4 pb-8 pt-4 shadow-xl lg:hidden dark:border-white/[0.06] dark:bg-[#0a0a0a]">
            <div className="mb-4 flex gap-4 border-b border-black/[0.06] pb-2 dark:border-white/[0.06]">
              {docsNav.map((tab) => (
                <button
                  key={tab.tab}
                  onClick={() => setSelectedTab(tab.tab)}
                  className={`relative pb-2 text-sm font-medium transition-colors ${
                    selectedTab === tab.tab
                      ? "text-black/80 dark:text-white/80"
                      : "text-black/35 hover:text-black/60 dark:text-white/35 dark:hover:text-white/60"
                  }`}
                >
                  {tab.tab}
                  {selectedTab === tab.tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-black/70 dark:bg-white/70" />
                  )}
                </button>
              ))}
            </div>
            <nav className="space-y-3">
              {currentTab.groups.map((group, i) => (
                <SidebarGroup
                  key={i}
                  group={group}
                  currentSlug={currentSlug}
                  titleMap={titleMap}
                  resolve={resolveHref}
                />
              ))}
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
