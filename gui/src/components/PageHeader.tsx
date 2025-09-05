import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export interface PageHeaderProps {
  onTitleClick?: () => void;
  title?: string;
  showBorder?: boolean;
}

export function PageHeader({ onTitleClick, title }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-20 m-0 flex items-center justify-between bg-inherit py-1">
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
