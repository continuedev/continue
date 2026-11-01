import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { type NavItem, type NavTab } from "@/config/docsNav";

const DOCS_DIR = process.env.DOCS_DIR || path.resolve(process.cwd(), "../docs");

export function getDocsDir() {
  return DOCS_DIR;
}

export function loadDocsNav(): NavTab[] {
  const docsJsonPath = path.join(DOCS_DIR, "docs.json");
  if (!fs.existsSync(docsJsonPath)) {
    console.warn(`docs.json not found at ${docsJsonPath}, using empty nav`);
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
  return raw.navigation?.tabs ?? [];
}

export const docsNav: NavTab[] = loadDocsNav();

function loadDocsRedirects(): Map<string, string> {
  const docsJsonPath = path.join(DOCS_DIR, "docs.json");
  if (!fs.existsSync(docsJsonPath)) return new Map();

  const raw = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
  const redirects = new Map<string, string>();
  for (const entry of raw.redirects ?? []) {
    const source = (entry.source as string).replace(/^\//, "");
    redirects.set(source, entry.destination as string);
  }
  return redirects;
}

export const docsRedirects: Map<string, string> = loadDocsRedirects();

// Whitelist of allowed external redirect domains for security
const ALLOWED_REDIRECT_DOMAINS = [
  "continue.dev",
  "docs.continue.dev",
  "www.continue.dev",
  "changelog.continue.dev",
];

export function resolveDocsRedirect(slug: string[]): string | null {
  const key = slug.join("/");
  const dest = docsRedirects.get(key);
  if (!dest) return null;

  // Handle external URLs
  if (dest.startsWith("https://") || dest.startsWith("http://")) {
    try {
      const url = new URL(dest);
      // Only allow redirects to whitelisted domains
      if (!ALLOWED_REDIRECT_DOMAINS.includes(url.hostname)) {
        console.warn(`Blocked redirect to untrusted domain: ${url.hostname}`);
        return null;
      }
      return dest;
    } catch {
      console.warn(`Invalid redirect URL: ${dest}`);
      return null;
    }
  }

  // Internal redirects - ensure they start with /
  return dest.startsWith("/") ? dest : `/${dest}`;
}

export interface DocFile {
  frontmatter: Record<string, any>;
  content: string;
  slug: string[];
}

export async function loadMdxFile(slug: string[]): Promise<DocFile | null> {
  const slugPath = slug.join("/");
  const filePath = path.join(DOCS_DIR, slugPath + ".mdx");

  if (fs.existsSync(filePath)) {
    return readDocFile(filePath, slug);
  }

  // Try index.mdx inside directory
  const indexPath = path.join(DOCS_DIR, slugPath, "index.mdx");
  if (fs.existsSync(indexPath)) {
    return readDocFile(indexPath, slug);
  }

  return null;
}

export async function loadRawMdxFile(
  slug: string[],
): Promise<{ raw: string; fileName: string } | null> {
  const slugPath = slug.join("/");
  const filePath = path.join(DOCS_DIR, slugPath + ".mdx");

  // Prevent path traversal — ensure the resolved path stays inside DOCS_DIR.
  const docsDirNormalized = DOCS_DIR.endsWith(path.sep)
    ? DOCS_DIR
    : DOCS_DIR + path.sep;
  const isWithinDocsDir = (p: string) => p.startsWith(docsDirNormalized);

  if (isWithinDocsDir(filePath) && fs.existsSync(filePath)) {
    return {
      raw: fs.readFileSync(filePath, "utf8"),
      fileName: slug[slug.length - 1] + ".md",
    };
  }

  const indexPath = path.join(DOCS_DIR, slugPath, "index.mdx");
  if (isWithinDocsDir(indexPath) && fs.existsSync(indexPath)) {
    return {
      raw: fs.readFileSync(indexPath, "utf8"),
      fileName: slug[slug.length - 1] + ".md",
    };
  }

  return null;
}

function readDocFile(filePath: string, slug: string[]): DocFile {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data: frontmatter, content } = matter(raw);

  const processed = preprocessMdx(content, slug);

  return { frontmatter, content: processed, slug };
}

/**
 * Preprocess MDX content:
 * 1. Find MDX snippet imports (import X from '/snippets/foo.mdx')
 * 2. Inline the snippet content in place of <X /> usage
 * 3. Strip JSX component imports (handled via components map)
 */
function preprocessMdx(content: string, slug: string[]): string {
  // Collect MDX snippet imports: import Name from '/snippets/file.mdx'
  const mdxImportRegex =
    /^import\s+(\w+)\s+from\s+['"]\/snippets\/([^'"]+\.mdx)['"];?\s*$/gm;
  const snippets = new Map<string, string>();
  let match;

  while ((match = mdxImportRegex.exec(content)) !== null) {
    const componentName = match[1]!;
    const snippetFile = match[2]!;
    const snippetPath = path.join(DOCS_DIR, "snippets", snippetFile);

    if (fs.existsSync(snippetPath)) {
      const snippetRaw = fs.readFileSync(snippetPath, "utf8");
      const { content: snippetContent } = matter(snippetRaw);
      snippets.set(componentName, snippetContent.trim());
    }
  }

  let result = content;

  // Replace <SnippetName /> with inlined content
  for (const [name, body] of Array.from(snippets.entries())) {
    const selfClosing = new RegExp(`<${name}\\s*/>`, "g");
    const withChildren = new RegExp(`<${name}\\s*>[\\s\\S]*?</${name}>`, "g");
    result = result.replace(selfClosing, body);
    result = result.replace(withChildren, body);
  }

  // Strip all remaining import statements (JSX snippets handled via components map)
  result = result.replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, "");

  // Convert :::warning / :::info / :::tip admonitions to JSX components
  result = result.replace(
    /^:::(warning|info|tip|note|danger)\s*\n([\s\S]*?)^:::\s*$/gm,
    (_match, type: string, body: string) => {
      const tag = type.charAt(0).toUpperCase() + type.slice(1);
      return `<${tag}>${body.trim()}</${tag}>`;
    },
  );

  // Ensure --- horizontal rules have blank lines before them
  // (prevents Setext h2 interpretation when preceded by text)
  // Only apply outside of fenced code blocks.
  result = result.replace(
    /(```[\s\S]*?```)|([^\n])\n---\n/g,
    (match, codeBlock, prev) => {
      if (codeBlock) return codeBlock; // leave code blocks untouched
      return `${prev}\n\n---\n`;
    },
  );

  // Rewrite image paths: /images/... → /images/docs/...
  result = result.replace(/src=["']\/images\//g, 'src="/images/docs/');

  // Rewrite markdown image paths: ![alt](/images/...) → ![alt](/images/docs/...)
  result = result.replace(/\]\(\/images\//g, "](/images/docs/");

  // Rewrite relative image paths: ![alt](../images/...) → ![alt](/images/docs/...)
  // Resolve relative to the current file's directory
  const fileDir = slug.slice(0, -1).join("/");
  result = result.replace(
    /\]\((\.\.?\/[^)]*\.(png|jpg|jpeg|gif|svg|webp))\)/gi,
    (_match, relPath: string) => {
      const resolved = path.posix.normalize(
        fileDir ? `${fileDir}/${relPath}` : relPath,
      );
      return `](/images/docs/${resolved})`;
    },
  );

  return result;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export function getHeadings(content: string): Heading[] {
  const regex = /^(#{2,4})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    headings.push({ level, text, id });
  }

  return headings;
}

export function getAllDocSlugs(): string[] {
  const slugs: string[] = [];
  function walk(items: NavItem[]) {
    for (const item of items) {
      if (typeof item === "string") slugs.push(item);
      else if (item.pages) walk(item.pages);
    }
  }
  for (const tab of docsNav) {
    for (const group of tab.groups) {
      walk(group.pages);
    }
  }
  return Array.from(new Set(slugs));
}

/**
 * Build a map of slug → display title by reading frontmatter from all docs.
 * Prefers sidebarTitle over title, falls back to slug-derived name.
 */
export function getAllDocTitles(): Record<string, string> {
  const slugs = getAllDocSlugs();
  const titles: Record<string, string> = {};

  for (const slug of slugs) {
    const slugPath = slug;
    const filePath = path.join(DOCS_DIR, slugPath + ".mdx");
    const indexPath = path.join(DOCS_DIR, slugPath, "index.mdx");

    let resolved: string | null = null;
    if (fs.existsSync(filePath)) resolved = filePath;
    else if (fs.existsSync(indexPath)) resolved = indexPath;

    if (resolved) {
      const raw = fs.readFileSync(resolved, "utf8");
      const { data } = matter(raw);
      const title = data.sidebarTitle || data.title;
      if (title) {
        titles[slug] = title;
      }
    }
  }

  return titles;
}
