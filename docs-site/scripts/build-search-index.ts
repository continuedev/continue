/**
 * Build-time script that generates the Orama search index as a static JSON file.
 * Run via: npx tsx scripts/build-search-index.ts
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { create, insert, save } from "@orama/orama";

const DOCS_DIR = path.resolve(__dirname, "../../docs");

function loadDocsNav() {
  const docsJsonPath = path.join(DOCS_DIR, "docs.json");
  if (!fs.existsSync(docsJsonPath)) return [];
  const raw = JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
  return raw.navigation?.tabs ?? [];
}

function getAllDocSlugs(nav: any[]): string[] {
  const slugs: string[] = [];
  function walk(items: any[]) {
    for (const item of items) {
      if (typeof item === "string") slugs.push(item);
      else if (item.pages) walk(item.pages);
    }
  }
  for (const tab of nav) {
    for (const group of tab.groups) {
      walk(group.pages);
    }
  }
  return Array.from(new Set(slugs));
}

function stripMdx(content: string): string {
  // Iteratively strip HTML tags to handle nested/malformed tags
  let stripped = content;
  let prev = "";
  while (prev !== stripped) {
    prev = stripped;
    stripped = stripped.replace(/<[^>]+>/g, "");
  }
  return stripped
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadMdxFile(slug: string) {
  const filePath = path.join(DOCS_DIR, slug + ".mdx");
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);
    return { frontmatter: data, content };
  }
  const indexPath = path.join(DOCS_DIR, slug, "index.mdx");
  if (fs.existsSync(indexPath)) {
    const raw = fs.readFileSync(indexPath, "utf8");
    const { data, content } = matter(raw);
    return { frontmatter: data, content };
  }
  return null;
}

async function main() {
  const nav = loadDocsNav();
  const slugs = getAllDocSlugs(nav);

  const db = create({
    schema: {
      title: "string" as const,
      path: "string" as const,
      content: "string" as const,
      section: "string" as const,
    },
  });

  for (const slug of slugs) {
    const doc = loadMdxFile(slug);
    if (!doc) continue;

    const title =
      doc.frontmatter.title ||
      slug
        .split("/")
        .pop()!
        .replace(/^\d+-/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

    const section = slug.split("/")[0] || "docs";
    const plainText = stripMdx(doc.content);

    insert(db, { title, path: slug, content: plainText, section });
  }

  const data = save(db);
  const outDir = path.resolve(__dirname, "../public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "search-index.json"),
    JSON.stringify(data),
  );
  console.log(
    `Search index written to public/search-index.json (${slugs.length} docs)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
