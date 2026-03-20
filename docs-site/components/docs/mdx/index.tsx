import type { MDXComponents } from "mdx/types";
import { Callout } from "./Callout";
import { CardGroup, Card } from "./CardGroup";
import { Steps, Step } from "./Steps";
import { DocsTabs, DocsTab } from "./DocsTabs";
import { DocsAccordion, DocsAccordionGroup } from "./DocsAccordion";
import { Columns } from "./Columns";
import { ModelRecommendations } from "./ModelRecommendations";
import { OSAutoDetect } from "./OSAutoDetect";
import { CodeBlock } from "./CodeBlock";
import { CodeGroup } from "./CodeGroup";
import { MdxLink } from "./MdxLink";

export const mdxComponents: MDXComponents = {
  // Mintlify callout variants
  Info: (props: any) => <Callout variant="info" {...props} />,
  Tip: (props: any) => <Callout variant="tip" {...props} />,
  Warning: (props: any) => <Callout variant="warning" {...props} />,
  Note: (props: any) => <Callout variant="note" {...props} />,
  Check: (props: any) => <Callout variant="tip" {...props} />,
  Danger: (props: any) => <Callout variant="warning" {...props} />,
  Callout,

  // Cards
  Card,
  CardGroup,

  // Steps
  Steps,
  Step,

  // Tabs
  Tabs: DocsTabs,
  Tab: DocsTab,

  // Accordion
  Accordion: DocsAccordion,
  AccordionGroup: DocsAccordionGroup,

  // Layout
  Columns,
  Frame: ({ children, ...props }: any) => (
    <div className="my-4" {...props}>
      {children}
    </div>
  ),

  // Custom snippets
  ModelRecommendations,
  OSAutoDetect,

  // Code blocks
  pre: (props: any) => <CodeBlock {...props} />,
  CodeGroup,

  // Use div instead of p to avoid hydration errors when MDX wraps
  // block-level components (Callout, Card, etc.) in paragraph tags.
  p: (props: any) => <div className="docs-p" {...props} />,

  // Rewrite internal doc links to include /docs prefix and resolve subdomain URLs
  a: MdxLink,

  // Rewrite image paths — images are copied to public/images/docs/ at build time
  img: ({ src, alt, ...props }: any) => {
    if (src && src.startsWith("/images/")) {
      src = `/images/docs${src.slice("/images".length)}`;
    }
    return <img src={src} alt={alt || ""} {...props} />;
  },
};
