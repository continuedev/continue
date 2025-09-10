import { ChevronRightIcon } from "@heroicons/react/24/outline";

interface ToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Toggle({
  isOpen,
  onToggle,
  title,
  subtitle,
  children,
}: ToggleProps) {
  return (
    <div>
      <div
        className="flex cursor-pointer items-start gap-2 text-left text-sm font-semibold"
        onClick={onToggle}
      >
        <ChevronRightIcon
          className={`mt-0.5 h-4 w-4 transition-transform ${
            isOpen ? "rotate-90" : ""
          }`}
        />
        <div>
          <span>{title}</span>
          {subtitle && (
            <p className="text-description my-1 text-xs font-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div
        className={`duration-400 overflow-hidden transition-all ease-in-out ${
          isOpen ? "mt-4 max-h-screen" : "max-h-0"
        }`}
      >
        <div className="pl-6">{children}</div>
      </div>
    </div>
  );
}
