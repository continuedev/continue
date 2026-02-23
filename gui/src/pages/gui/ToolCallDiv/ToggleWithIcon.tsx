import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { ComponentType, useState } from "react";

interface ToggleWithIconProps {
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
  isToggleable?: boolean;
  open?: boolean;
  onClick?: () => void;
  className?: string;
  isClickable?: boolean;
}

export function ToggleWithIcon({
  icon: Icon,
  isToggleable = false,
  open = false,
  onClick,
  className = "",
  isClickable = false,
}: ToggleWithIconProps) {
  const [isHovered, setIsHovered] = useState(false);
  const showChevron = isToggleable && (isHovered || open);

  function handleClick() {
    if ((isToggleable || isClickable) && onClick) {
      onClick();
    }
  }

  function renderIcon() {
    if (!Icon && !isToggleable) {
      return null;
    }

    if (showChevron) {
      return (
        <ChevronRightIcon
          className={`text-description h-4 w-4 transition-transform duration-200 ease-in-out ${
            open ? "rotate-90" : "rotate-0"
          }`}
        />
      );
    }

    return Icon ? <Icon className="text-description h-4 w-4" /> : null;
  }

  return (
    <div
      className={`flex h-4 w-4 flex-shrink-0 flex-col items-center justify-center ${className}`}
      onClick={isToggleable || isClickable ? handleClick : undefined}
      onMouseEnter={isToggleable ? () => setIsHovered(true) : undefined}
      onMouseLeave={isToggleable ? () => setIsHovered(false) : undefined}
    >
      {renderIcon()}
    </div>
  );
}
