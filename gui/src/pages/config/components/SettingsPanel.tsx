import React, { Fragment } from "react";
import { Card, Divider } from "../../../components/ui";
import { cn } from "../../../util/cn";

interface SettingsPanelProps {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  anchorId?: string;
  headerAction?: React.ReactNode;
}

export function SettingsPanel({
  title,
  description,
  children,
  className = "",
  contentClassName = "",
  anchorId,
  headerAction,
}: SettingsPanelProps) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <section
      className={cn("scroll-mt-6 space-y-3", className)}
      data-config-anchor={anchorId}
      data-testid={anchorId ? `config-anchor-${anchorId}` : undefined}
    >
      {(title || description) && (
        <div className="flex items-start justify-between gap-4 px-0.5">
          <div>
            {title && <h3 className="text-base font-semibold">{title}</h3>}
            {description && (
              <div className="text-description mt-1 text-sm leading-6">
                {description}
              </div>
            )}
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}

      <Card className="border-command-border bg-vsc-editor-background/60 overflow-hidden rounded-xl border border-solid !px-0 !py-0">
        <div className={cn("flex flex-col", contentClassName)}>
          {items.map((child, index) => (
            <Fragment key={index}>
              {index > 0 && <Divider className="!my-0" />}
              {child}
            </Fragment>
          ))}
        </div>
      </Card>
    </section>
  );
}
