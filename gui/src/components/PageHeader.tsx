import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export interface PageHeaderProps {
  onClick: () => void;
  title: string;
}

export default function PageHeader({ onClick, title }: PageHeaderProps) {
  return (
    <div className="border-b-border sticky top-0 z-20 m-0 flex items-center border-0 border-b border-solid bg-inherit p-0">
      <div
        className="cursor-pointer transition-colors duration-200 hover:opacity-80"
        onClick={onClick}
      >
        <ArrowLeftIcon className="ml-3 inline-block h-3 w-3" />
        <span className="m-2 inline-block text-base font-bold">{title}</span>
      </div>
    </div>
  );
}
