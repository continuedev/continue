"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import React, { Children, isValidElement } from "react";

/**
 * CodeGroup renders multiple code blocks as tabs.
 * Tab labels are derived from code block data-title attributes
 * or fall back to "Tab 1", "Tab 2", etc.
 */
export function CodeGroup({ children }: { children: React.ReactNode }) {
  const blocks: { label: string; content: React.ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    // After MDX compilation, each code block is wrapped by CodeBlock (a div > pre > code)
    // Try to find a label from props
    const props = child.props as Record<string, any>;
    let label = props["data-title"] || props.title || "";

    if (!label && props.children) {
      // Try to find label from the inner pre/code className
      const text = extractTextContent(child);
      // Guess label from package manager command (check longer names first)
      if (text.includes("pnpm ")) label = "pnpm";
      else if (text.includes("yarn ")) label = "yarn";
      else if (text.includes("npm ")) label = "npm";
      else if (text.includes("bun ")) label = "bun";
      else if (text.includes("brew ")) label = "brew";
      else if (text.includes("pip ")) label = "pip";
      else if (text.includes("cargo ")) label = "cargo";
    }

    if (!label) label = `Tab ${blocks.length + 1}`;
    blocks.push({ label, content: child });
  });

  if (blocks.length === 0) return <>{children}</>;
  if (blocks.length === 1) return <>{blocks[0]!.content}</>;

  return (
    <TabsPrimitive.Root defaultValue="0" className="my-4">
      <TabsPrimitive.List className="flex border-b border-black/[0.08] dark:border-white/[0.08]">
        {blocks.map((block, i) => (
          <TabsPrimitive.Trigger
            key={i}
            value={String(i)}
            className="-mb-px px-4 py-2 text-sm text-black/40 transition-colors data-[state=active]:border-b-2 data-[state=active]:border-black/80 data-[state=active]:text-black/80 dark:text-white/40 dark:data-[state=active]:border-white/80 dark:data-[state=active]:text-white/80"
          >
            {block.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {blocks.map((block, i) => (
        <TabsPrimitive.Content key={i} value={String(i)} className="pt-2">
          {block.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

function extractTextContent(element: React.ReactElement): string {
  const props = element.props as Record<string, any>;
  if (typeof props.children === "string") return props.children;
  if (Array.isArray(props.children)) {
    return props.children
      .map((c: any) =>
        typeof c === "string"
          ? c
          : isValidElement(c)
            ? extractTextContent(c)
            : "",
      )
      .join("");
  }
  if (isValidElement(props.children)) {
    return extractTextContent(props.children);
  }
  return "";
}
