import React from "react";

interface ConfigSubsectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ConfigSubsection({
  title,
  children,
  className = "",
}: ConfigSubsectionProps) {
  return (
    <div className={className}>
      {title && <h3 className="mb-2 text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  );
}
