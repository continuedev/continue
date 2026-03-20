"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { type NavGroup, type NavItem, type NavTab } from "@/config/docsNav";
import { TableOfContents } from "./TableOfContents";
import { DocsSearch } from "./DocsSearch";
import { resolveHref } from "@/lib/resolveHref";
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
  return nav[nav.length - 1];
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
    return <div className="w-8 h-8" />;
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
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
        className="flex w-full items-center justify-between py-1.5 px-2.5 -mx-2.5 text-[13px] text-black/45 dark:text-white/45 hover:text-black/70 dark:hover:text-white/70"
      >
        <span>{group.group}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-black/30 dark:text-white/30 transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="ml-3 border-l border-black/[0.06] dark:border-white/[0.06] pl-3 space-y-0.5">
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
        className={`block py-1.5 px-2.5 -mx-2.5 rounded text-[13px] transition-colors no-underline ${
          isActive
            ? "text-black/90 dark:text-white/90 font-medium bg-black/[0.04] dark:bg-white/[0.06]"
            : "text-black/45 dark:text-white/45 hover:text-black/70 dark:hover:text-white/70"
        }`}
      >
        {slugToLabel(item, titleMap)}
      </Link>
    );
  }

  return (
    <SidebarGroup group={item} currentSlug={currentSlug} titleMap={titleMap} resolve={resolve} depth={depth} />
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
  const currentTab =
    docsNav.find((t) => t.tab === selectedTab) ?? docsNav[0]!;
  const navLinks = NAV_LINKS;

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header: nav + tabs ---- */}
      <div className="flex-shrink-0 z-30 bg-white dark:bg-[#0a0a0a]">
        {/* Top nav bar */}
        <nav className="border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center max-w-[90rem] mx-auto">
            {/* Logo — same width & padding as sidebar */}
            <div className={`hidden lg:flex items-center ${SIDEBAR_W} flex-shrink-0 px-5 py-3`}>
              <Link href={resolveHref("/")} className="flex items-center">
                <img
                  src="/images/continue-logo-light.png"
                  alt="Continue"
                  className="h-8 w-auto dark:invert"
                />
              </Link>
            </div>
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center px-5 py-3">
              <Link href={resolveHref("/")} className="flex items-center">
                <img
                  src="/images/continue-logo-light.png"
                  alt="Continue"
                  className="h-8 w-auto dark:invert"
                />
              </Link>
            </div>
            {/* Centered search */}
            <div className="flex-1 flex items-center justify-center px-5 py-3">
              <DocsSearch resolve={resolveHref} />
            </div>
            {/* Right nav */}
            <div className="flex items-center gap-6 px-5 py-3">
              <div className="hidden md:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`${NAV_LINK_CLASSES} ${
                      link.label === "Docs" ? "text-black/70 dark:text-white/70" : ""
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
                className="md:hidden p-2 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden flex flex-col gap-4 px-5 pt-4 pb-2">
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
          <div className="max-w-[90rem] mx-auto px-5 flex gap-6">
            {docsNav.map((tab) => (
              <button
                key={tab.tab}
                onClick={() => setSelectedTab(tab.tab)}
                className={`relative py-2.5 text-sm font-medium transition-colors ${
                  selectedTab === tab.tab
                    ? "text-black/80 dark:text-white/80"
                    : "text-black/35 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60"
                }`}
              >
                {tab.tab}
                {selectedTab === tab.tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/70 dark:bg-white/70 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Content area ---- */}
      <div className="flex-1 min-h-0 flex w-full max-w-[90rem] mx-auto">
        {/* Desktop sidebar */}
        <aside className={`hidden lg:block ${SIDEBAR_W} flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto pt-5 pb-8 px-5`}>
          <nav className="space-y-5">
            {currentTab.groups.map((group, i) => (
              <SidebarGroup key={i} group={group} currentSlug={currentSlug} titleMap={titleMap} resolve={resolveHref} />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto px-8 pt-10 pb-8 lg:px-20">{children}</main>

        {/* Table of contents */}
        <TableOfContents headings={headings} />
      </div>

      {/* ---- Mobile sidebar ---- */}
      <button
        className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-black/80 dark:bg-white/80 text-white dark:text-black rounded-full shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/20 dark:bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-[#0a0a0a] border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto pt-4 pb-8 px-4 shadow-xl">
            <div className="flex gap-4 mb-4 border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
              {docsNav.map((tab) => (
                <button
                  key={tab.tab}
                  onClick={() => setSelectedTab(tab.tab)}
                  className={`relative pb-2 text-sm font-medium transition-colors ${
                    selectedTab === tab.tab
                      ? "text-black/80 dark:text-white/80"
                      : "text-black/35 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60"
                  }`}
                >
                  {tab.tab}
                  {selectedTab === tab.tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/70 dark:bg-white/70 rounded-full" />
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
