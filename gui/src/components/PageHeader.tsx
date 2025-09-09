import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export interface PageHeaderProps {
  onTitleClick?: () => void;
  title?: string;
  showBorder?: boolean;
}

export function PageHeader({
  onTitleClick,
  title,
  showBorder = true,
}: PageHeaderProps) {
  return (
    <div
      className={`border-command-border sticky top-0 z-20 m-0 flex items-center justify-between border border-x-0 ${showBorder ? "border-b" : "border-b-0"} border-t-0 border-solid bg-inherit py-3.5`}
    >
      <div
        className="flex cursor-pointer items-center transition-colors duration-200 hover:brightness-125"
        onClick={onTitleClick}
      >
        <ArrowLeftIcon className="ml-3 inline-block h-3 w-3" />
        {title && <span className="mx-2 inline-block font-bold">{title}</span>}
      </div>
    </div>
  );
}
