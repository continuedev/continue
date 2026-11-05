import { withBasePath } from "@/lib/basePath";
import { resolveHref } from "@/lib/resolveHref";

export function MdxLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href?.startsWith("/")) {
    const internalPath = href.startsWith("/docs") ? href : `/docs${href}`;
    href = resolveHref(internalPath);
    // A plain <a> does not get Next's basePath, so add it here (the site is
    // served under /<repo>/ on GitHub Pages).
    if (href.startsWith("/")) href = withBasePath(href);
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
