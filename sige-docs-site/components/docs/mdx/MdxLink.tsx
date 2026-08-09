import { resolveHref } from "@/lib/resolveHref";

export function MdxLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href?.startsWith("/")) {
    const internalPath = href.startsWith("/docs") ? href : `/docs${href}`;
    href = resolveHref(internalPath);
  }

  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
