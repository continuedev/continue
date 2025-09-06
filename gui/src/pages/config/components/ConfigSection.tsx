import React from "react";

interface ConfigSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function ConfigSection({
  children,
  className = "",
}: ConfigSectionProps) {
  return (
    <div className={`py-4 ${className}`}>
      {children}
    </div>
  );
}