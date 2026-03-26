"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import React, { Children, isValidElement } from "react";

export function DocsTabs({ children }: { children: React.ReactNode }) {
  const tabs: { title: string; content: React.ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as Record<string, any>;
      // Check for title prop — the signature of a Tab child.
      // We can't rely on displayName across the RSC serialization boundary.
      if ("title" in props) {
        tabs.push({
          title: props.title || `Tab ${tabs.length + 1}`,
          content: props.children,
        });
      }
    }
  });

  if (tabs.length === 0) return <>{children}</>;

  return (
    <TabsPrimitive.Root defaultValue="0" className="my-4">
      <TabsPrimitive.List className="flex border-b border-black/[0.08] dark:border-white/[0.08]">
        {tabs.map((tab, i) => (
          <TabsPrimitive.Trigger
            key={i}
            value={String(i)}
            className="-mb-px px-4 py-2 text-sm text-black/40 transition-colors data-[state=active]:border-b-2 data-[state=active]:border-black/80 data-[state=active]:text-black/80 dark:text-white/40 dark:data-[state=active]:border-white/80 dark:data-[state=active]:text-white/80"
          >
            {tab.title}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab, i) => (
        <TabsPrimitive.Content key={i} value={String(i)} className="pt-4">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

export function DocsTab({
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
DocsTab.displayName = "DocsTab";
