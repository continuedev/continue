import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface CopyButtonWithTextProps {
  text: string;
  variant: "default" | "link" | "destructive" | "outline" | "secondary" | "ghost" | "animated";
  onTextClick?: (text: string) => void;
  className?: string;
  buttonSize?: "default" | "sm" | "lg";
  tooltipContentClassName?: string;
  side?: "top" | "bottom" | "right" | "left";
}

export default function CopyButtonWithText({
  text,
  onTextClick = () => {},
  variant,
  className = "",
  buttonSize = "sm",
  tooltipContentClassName = "bg-input p-2 border rounded-lg shadow-lg",
  side = 'top'
}: CopyButtonWithTextProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (forceShow) {
      timeout = setTimeout(() => {
        setForceShow(false);
        setOpen(false);
        setTimeout(() => {
          setCopied(false);
        }, 100);
      }, 600);
    }
    return () => clearTimeout(timeout);
  }, [forceShow]);

  const handleClick = () => {
    onTextClick?.(text);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setOpen(true);
    setForceShow(true);
  };

  return (
    <TooltipProvider>
      <Tooltip 
        open={forceShow || open}
        onOpenChange={(newOpen) => {
          if (!forceShow) {
            setOpen(newOpen);
          }
        }}
        delayDuration={100}
      >
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            variant={variant}
            className={className}
            size={buttonSize}
          >
            {text}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={-8} side={side}>
          <p className={`${tooltipContentClassName}`}>{copied ? "Copied!" : "Copy"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
