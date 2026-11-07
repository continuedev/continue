import { visit } from "unist-util-visit";

const TEXT_ALIGN = new Set(["left", "right", "center", "justify"]);

/**
 * Turns the `align` of table cells into a `style` object before rendering.
 *
 * Left alone, rehype-react 6 (used by react-remark) converts `align` into a
 * `style` *string* ("text-align: null" for unaligned columns), and relies on
 * hast-to-hyperscript to parse it into an object. hast-to-hyperscript only
 * does that when it recognises React by the `_owner`/`_store` fields of an
 * element, which React 19 production builds no longer have, so React gets a
 * string `style` and throws (minified error #62) for every markdown table.
 */
export function rehypeTableCellAlign() {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "th" && node.tagName !== "td") return;
      const properties = node.properties;
      if (!properties || !("align" in properties)) return;

      const { align, ...rest } = properties;
      node.properties = rest;
      if (typeof align === "string" && TEXT_ALIGN.has(align)) {
        node.properties.style = {
          ...(typeof rest.style === "object" ? rest.style : {}),
          textAlign: align,
        };
      }
    });
  };
}
