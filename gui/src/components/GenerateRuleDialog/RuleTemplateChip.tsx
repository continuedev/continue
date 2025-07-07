import React from "react";
import { Button } from "../ui";

interface RuleTemplateChipProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  onClick: () => void;
}

export function RuleTemplateChip({
  icon: Icon,
  text,
  onClick,
}: RuleTemplateChipProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2"
      variant="secondary"
    >
      <Icon className="h-3 w-3" />
      <span className="text-xs">{text}</span>
    </Button>
  );
}
