import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useContext, useRef } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { addCodeToEdit } from "../../redux/slices/sessionSlice";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";

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
        <ListboxButton
          ref={buttonRef}
          className="bg-vsc-editor-background m-0 rounded-md p-0"
        >
          <div
            className="flex h-5 items-center justify-center gap-1 hover:brightness-125"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
          >
            <PlusIcon className="text-vsc-foreground inline h-2.5 w-2.5 px-1 brightness-75" />
            <span className="text-vsc-foreground xs:block hidden text-[10px] brightness-75">
              Add file
            </span>
          </div>

          <div className="border-lightgray/50 h-4 w-[1px] border-y-0 border-l-0 border-r border-solid" />

          <ChevronDownIcon className="text-vsc-foreground h-2.5 w-2.5 cursor-pointer px-1 brightness-75 hover:brightness-125" />
        </ListboxButton>

        <ListboxOptions className="bg-vsc-editor-background" anchor="top end">
          <ListboxOption value="addAllFiles">Add all open files</ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
