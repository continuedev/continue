import { ComponentType, SVGProps } from "react";
import { GhostButton } from "../../..";
import { fontSize } from "../../../../util";

interface BaseIconButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  text: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function BaseIconButton({
  icon: Icon,
  text,
  onClick,
  className = "w-full cursor-pointer rounded px-2 py-0.5 text-center",
  style = { fontSize: fontSize(-3) },
}: BaseIconButtonProps) {
  return (
    <GhostButton
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 pr-1" />
        <span className="text-[11px]">{text}</span>
      </div>
    </GhostButton>
  );
}
