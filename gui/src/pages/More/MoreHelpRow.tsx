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
      className="hover:bg-description/30 flex cursor-pointer items-center justify-between gap-2 rounded px-4 py-2"
      onClick={onClick}
    >
      <div className="flex w-4/5 flex-col justify-center">
        <h3 className="my-0 text-sm">{title}</h3>
        <span className="text-description py-1 text-xs">{description}</span>
      </div>

      <div className="text-description flex h-5 w-5 cursor-pointer justify-end">
        <Icon />
      </div>
    </div>
  );
}

export default MoreHelpRow;
