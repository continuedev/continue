import React from "react";

interface ConfigSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// ConfigSection for internal section organization within pages
// Not used as page wrapper - that's handled by ConfigPageLayout
export function ConfigSection({
  title,
  children,
  className = "",
}: ConfigSectionProps) {
  return (
    <div className={className}>
      {title && <h3 className="mb-4 text-base font-semibold">{title}</h3>}
      {children}
    </div>
  );
}
