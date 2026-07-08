// Navigation types and pure helpers for docs sidebar.
// Data loading happens server-side in lib/docs.ts — these are safe for client components.

export type NavItem = string | NavGroup;

export interface NavGroup {
  group: string;
  icon?: string;
  expanded?: boolean;
  pages: NavItem[];
}

export interface NavTab {
  tab: string;
  groups: NavGroup[];
}

// Flatten all page slugs in order for prev/next navigation
function flattenPages(items: NavItem[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      result.push(item);
    } else {
      result.push(...flattenPages(item.pages));
    }
  }
  return result;
}

function getAllPagesFlat(nav: NavTab[]): string[] {
  const all: string[] = [];
  for (const tab of nav) {
    for (const group of tab.groups) {
      all.push(...flattenPages(group.pages));
    }
  }
  // Deduplicate while preserving order
  return Array.from(new Set(all));
}

function slugToTitle(slug: string): string {
  const name = slug.split("/").pop() || slug;
  return name
    .replace(/^\d+-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function getPageNavigation(
  nav: NavTab[],
  currentSlug: string,
  titleMap?: Record<string, string>,
): {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
} {
  const pages = getAllPagesFlat(nav);
  const idx = pages.indexOf(currentSlug);

  if (idx === -1) return { prev: null, next: null };

  const prevSlug = idx > 0 ? pages[idx - 1] : undefined;
  const nextSlug = idx < pages.length - 1 ? pages[idx + 1] : undefined;

  const getTitle = (slug: string) => titleMap?.[slug] || slugToTitle(slug);

  const prev = prevSlug ? { slug: prevSlug, title: getTitle(prevSlug) } : null;
  const next = nextSlug ? { slug: nextSlug, title: getTitle(nextSlug) } : null;

  return { prev, next };
}
