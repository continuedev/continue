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
      className="flex items-center gap-2 justify-between cursor-pointer"
      onClick={onClick}
    >
      <div className="w-4/5 truncate flex flex-col justify-center">
        <h3 className="text-sm my-0">{title}</h3>
        <span className="text-stone-500 py-1">{description}</span>
      </div>

      <div className="flex justify-end w-1/5 cursor-pointer w-5 h-5 text-stone-500">
        <Icon />
      </div>
    </div>
  );
}

export default MoreHelpRow;
