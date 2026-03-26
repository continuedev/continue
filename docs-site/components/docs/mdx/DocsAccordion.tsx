"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import React, { Children, isValidElement } from "react";

export function DocsAccordionGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  // Collect accordion items and assign unique values
  const items: { title: string; content: React.ReactNode; value: string }[] =
    [];
  Children.forEach(children, (child, i) => {
    if (isValidElement(child)) {
      const props = child.props as Record<string, any>;
      if (props.title) {
        items.push({
          title: props.title,
          content: props.children,
          value: `item-${i}`,
        });
      }
    }
  });

  if (items.length === 0) return <>{children}</>;

  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      className="my-4 overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/[0.06]"
    >
      {items.map((item, i) => (
        <AccordionPrimitive.Item
          key={item.value}
          value={item.value}
          className={
            i > 0 ? "border-t border-black/[0.06] dark:border-white/[0.06]" : ""
          }
        >
          <AccordionPrimitive.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-black/70 transition-colors hover:text-black/90 dark:text-white/70 dark:hover:text-white/90 [&[data-state=open]>svg]:rotate-180">
            {item.title}
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-black/30 transition-transform duration-200 dark:text-white/30" />
          </AccordionPrimitive.Trigger>
          <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm">
            <div className="px-4 pb-4 text-black/60 dark:text-white/60">
              {item.content}
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
}

export function DocsAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  // Standalone accordion (not inside a group)
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      className="my-4 overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/[0.06]"
    >
      <AccordionPrimitive.Item value="item">
        <AccordionPrimitive.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-black/70 transition-colors hover:text-black/90 dark:text-white/70 dark:hover:text-white/90 [&[data-state=open]>svg]:rotate-180">
          {title}
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-black/30 transition-transform duration-200 dark:text-white/30" />
        </AccordionPrimitive.Trigger>
        <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm">
          <div className="px-4 pb-4 text-black/60 dark:text-white/60">
            {children}
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
}
