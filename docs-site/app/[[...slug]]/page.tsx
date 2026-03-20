import { compileMDX } from "next-mdx-remote/rsc";
import NotFoundPage from "@/app/components/NotFoundPage";
import { ClientRedirect } from "@/app/components/ClientRedirect";
import { Metadata } from "next/types";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrismPlus from "rehype-prism-plus";
import {
  loadMdxFile,
  getHeadings,
  getAllDocTitles,
  getAllDocSlugs,
  docsNav,
  resolveDocsRedirect,
  docsRedirects,
} from "@/lib/docs";
import { getPageNavigation } from "@/config/docsNav";
import { mdxComponents } from "@/components/docs/mdx";
import { DocsShell } from "@/components/docs/DocsShell";
import { PageNav } from "@/components/docs/PageNav";
import { CopyPageButton } from "@/components/docs/CopyPageButton";
import "../docs.css";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const docSlugs = getAllDocSlugs();
  const params: { slug: string[] }[] = [];

  // Root page (index)
  params.push({ slug: [] });

  // All doc pages from navigation
  for (const slug of docSlugs) {
    params.push({ slug: slug.split("/") });
  }

  // All redirect source pages
  for (const source of docsRedirects.keys()) {
    params.push({ slug: source.split("/") });
  }

  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await loadMdxFile(slug || ["index"]);
  if (!doc) return {};

  return {
    title: doc.frontmatter.title
      ? `${doc.frontmatter.title} | Continue Docs`
      : "Continue Docs",
    description: doc.frontmatter.description || "",
  };
}

export default async function DocsPage({ params }: Props) {
  const { slug } = await params;
  const slugPath = slug || ["index"];

  // Check redirect first
  const redirectTo = resolveDocsRedirect(slugPath);
  if (redirectTo) {
    const target = redirectTo.startsWith("http")
      ? redirectTo
      : `/docs${redirectTo}`;
    return <ClientRedirect to={target} />;
  }

  const doc = await loadMdxFile(slugPath);
  if (!doc) {
    return <NotFoundPage />;
  }

  const headings = getHeadings(doc.content);
  const titleMap = getAllDocTitles();

  const { content } = await compileMDX({
    source: doc.content,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "wrap",
              properties: { className: ["heading-anchor"] },
            },
          ],
          [rehypePrismPlus, { ignoreMissing: true }],
        ],
      },
    },
    components: mdxComponents,
  });

  const currentSlug = (slug || ["index"]).join("/");
  const { prev, next } = getPageNavigation(docsNav, currentSlug, titleMap);

  return (
    <DocsShell
      currentSlug={currentSlug}
      headings={headings}
      titleMap={titleMap}
      docsNav={docsNav}
    >
      {doc.frontmatter.title && (
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-light tracking-tight text-black/90 dark:text-white/90">
            {doc.frontmatter.title}
          </h1>
          <CopyPageButton slug={currentSlug} />
        </div>
      )}
      {doc.frontmatter.description && (
        <p className="mb-8 text-lg text-black/50 dark:text-white/50">
          {doc.frontmatter.description.replace(/\*\*/g, "")}
        </p>
      )}
      <div className="docs-content max-w-3xl">{content}</div>
      <div className="max-w-3xl">
        <PageNav prev={prev} next={next} />
      </div>
    </DocsShell>
  );
}
