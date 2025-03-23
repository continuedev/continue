import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { ToolbarOptions } from "../../InputToolbar";
import HoverItem from "../bottom/HoverItem";

interface TopInputToolbarProps {
  toolbarOptions?: ToolbarOptions;
  onAddContextItem?: () => void;
  lumpOpen: boolean;
  setLumpOpen: (open: boolean) => void;
}
export function TopInputToolbar(props: TopInputToolbarProps) {
  return (
    <div className="-mb-2 -mt-1 flex items-center">
      <HoverItem
        onClick={() => props.setLumpOpen(!props.lumpOpen)}
        className="ml-auto"
      >
        <EllipsisHorizontalIcon className="h-3 w-3 text-gray-400 hover:brightness-125" />
      </HoverItem>
    </div>
  );
}
