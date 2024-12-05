import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export interface PageHeaderProps {
  onClick: () => void;
  title: string;
}

export default function PageHeader({ onClick, title }: PageHeaderProps) {
  return (
    <div className="bg-vsc-background sticky top-0 m-0 flex items-center border-0 border-b border-solid border-b-zinc-700 bg-inherit p-0">
      <div
        className="cursor-pointer transition-colors duration-200 hover:text-zinc-100"
        onClick={onClick}
      >
        <ArrowLeftIcon className="ml-3 inline-block h-3 w-3" />
        <span className="m-2 inline-block text-base font-bold">{title}</span>
      </div>
    </div>
  );
}
