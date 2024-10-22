interface MoreHelpRowProps {
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  Icon: any;
}

function MoreHelpRow({ title, description, onClick, Icon }: MoreHelpRowProps) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between gap-2"
      onClick={onClick}
    >
      <div className="flex w-4/5 flex-col justify-center">
        <h3 className="my-0 text-sm">{title}</h3>
        <span className="py-1 text-xs text-stone-500">{description}</span>
      </div>

      <div className="flex h-5 w-1/5 w-5 cursor-pointer justify-end text-stone-500">
        <Icon />
      </div>
    </div>
  );
}

export default MoreHelpRow;
