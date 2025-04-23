import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ComponentType, useState } from "react";
import { lightGray, vscBackground } from ".";

interface ToggleProps {
  children: React.ReactNode;
  title: React.ReactNode;
  icon?: ComponentType<React.SVGProps<SVGSVGElement>>;
}

function ToggleDiv({ children, title, icon: Icon }: ToggleProps) {
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`pl-2 pt-2`}
      style={{
        backgroundColor: vscBackground,
      }}
    >
      <div
        className="flex cursor-pointer items-center justify-start text-xs text-gray-300"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="context-items-peek"
      >
        <div className="relative mr-1 h-4 w-4">
          {Icon && !isHovered && !open ? (
            <Icon className={`absolute h-4 w-4 text-[${lightGray}]`} />
          ) : (
            <>
              <ChevronRightIcon
                className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
                  open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                }`}
              />
              <ChevronDownIcon
                className={`absolute h-4 w-4 transition-all duration-200 ease-in-out text-[${lightGray}] ${
                  open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                }`}
              />
            </>
          )}
        </div>
        <span
          className="ml-1 text-xs text-gray-400 transition-colors duration-200"
          data-testid="toggle-div-title"
        >
          {title}
        </span>
      </div>

      <div
        className={`mt-2 overflow-y-auto transition-all duration-300 ease-in-out ${
          open ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default ToggleDiv;
