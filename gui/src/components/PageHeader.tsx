import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getFontSize } from "../util";

export interface PageHeaderProps {
  onTitleClick?: () => void;
  title?: string;
  rightContent?: React.ReactNode;
  showBorder?: boolean;
}

export default function PageHeader({
  onTitleClick,
  title,
  rightContent,
  showBorder,
}: PageHeaderProps) {
  return (
    <div
      className={`bg-vsc-background sticky top-0 z-20 m-0 flex items-center justify-between bg-inherit ${
        showBorder
          ? "border-0 border-b-[1px] border-solid border-b-zinc-700"
          : ""
      }`}
    >
      <div className="flex w-full items-center justify-between pr-4">
        {title && (
          <>
            <div
              className="flex cursor-pointer items-center transition-colors duration-200 hover:text-zinc-100"
              onClick={onTitleClick}
            >
              <ArrowLeftIcon className="ml-3 inline-block h-3 w-3" />
              <span
                className="mx-2 inline-block text-base font-bold"
                style={{
                  fontSize: `${getFontSize() - 2}px`,
                }}
              >
                {title}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="ml-auto">{rightContent}</div>
    </div>
  );
}
