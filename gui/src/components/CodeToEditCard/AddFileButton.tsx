import { useContext, useRef } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Listbox } from "@headlessui/react";
import { addCodeToEdit } from "../../redux/slices/sessionSlice";
import { useAppDispatch } from "../../redux/hooks";

export interface AddFileButtonProps {
  onClick: () => void;
}

export default function AddFileButton({ onClick }: AddFileButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  async function handleAddAllOpenFiles() {
    const openFiles = await ideMessenger.ide.getOpenFiles();
    const filesData = await Promise.all(
      openFiles.map(async (filepath) => {
        const contents = await ideMessenger.ide.readFile(filepath);
        return { filepath, contents };
      }),
    );

    dispatch(addCodeToEdit(filesData));
  }

  return (
    <Listbox onChange={handleAddAllOpenFiles}>
      <div className="relative">
        <Listbox.Button
          ref={buttonRef}
          className="bg-vsc-editor-background border-lightgray/50 flex h-5 cursor-pointer items-center justify-between rounded-md border border-solid px-0 shadow-sm transition-colors"
        >
          <div
            className="flex h-5 w-14 items-center justify-center gap-1 hover:brightness-125"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
          >
            <PlusIcon className="text-vsc-foreground inline h-2.5 w-2.5 brightness-75" />
            <span className="text-vsc-foreground text-[10px] brightness-75">
              Add file
            </span>
          </div>

          <div className="border-lightgray/50 h-4 w-[1px] border-y-0 border-l-0 border-r border-solid" />

          <ChevronDownIcon className="text-vsc-foreground h-2.5 w-2.5 cursor-pointer px-1 brightness-75 hover:brightness-125" />
        </Listbox.Button>

        <Listbox.Options className="bg-vsc-editor-background border-lightgray/50 absolute right-0 top-full z-50 mt-1 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg">
          <Listbox.Option
            value="addAllFiles"
            className="text-vsc-foreground block w-full cursor-pointer px-2 py-1 text-left text-[10px] brightness-75 hover:brightness-125"
          >
            Add all open files
          </Listbox.Option>
        </Listbox.Options>
      </div>
    </Listbox>
  );
}
