import { useContext, useState, useRef, useEffect } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setShouldAddFileForEditing } from "../../redux/slices/uiStateSlice";
import { useDispatch } from "react-redux";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { addCodeToEdit } from "../../redux/slices/editModeState";
import { Listbox } from "@headlessui/react";

export default function AddFileButton() {
  const [showAbove, setShowAbove] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  function onClickAddFileToCodeToEdit() {
    dispatch(setShouldAddFileForEditing(true));
  }

  async function handleAddAllOpenFiles() {
    const openFiles = await ideMessenger.ide.getOpenFiles();

    for (const filepath of openFiles) {
      const contents = await ideMessenger.ide.readFile(filepath);
      console.log({ filepath, contents });
      dispatch(addCodeToEdit({ filepath, contents }));
    }
  }

  //   function calculatePosition() {
  //     const rect = buttonRef.current?.getBoundingClientRect();
  //     if (!rect) return;
  //     const spaceBelow = window.innerHeight - rect.bottom;
  //     const spaceAbove = rect.top;
  //     const dropdownHeight = 300;

  //     setShowAbove(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
  //   }

  return (
    <Listbox onChange={handleAddAllOpenFiles}>
      <div className="relative">
        <Listbox.Button
          ref={buttonRef}
          //   onClick={calculatePosition}
          className="bg-lightgray/10 border-lightgray flex cursor-pointer items-center justify-between rounded-md border border-solid px-0 shadow-sm transition-colors"
        >
          <div
            className="flex items-center gap-1 px-1.5 hover:brightness-125"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClickAddFileToCodeToEdit();
            }}
          >
            <PlusIcon className="text-vsc-foreground inline h-2.5 w-2.5" />
            <span className="text-vsc-foreground text-[10px]">Add file</span>
          </div>

          <div className="border-lightgray h-4 w-[1px] border-y-0 border-l-0 border-r border-solid" />

          <ChevronDownIcon className="text-vsc-foreground h-2.5 w-2.5 cursor-pointer px-1 hover:brightness-125" />
        </Listbox.Button>

        <Listbox.Options
          className={`bg-vsc-input-background border-lightgray absolute right-0 z-50 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg ${
            showAbove ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <Listbox.Option
            value="addAllFiles"
            className="text-vsc-foreground hover:bg-lightgray/33 block w-full cursor-pointer px-2 py-1 text-left text-[10px]"
          >
            Add all open files
          </Listbox.Option>
        </Listbox.Options>
      </div>
    </Listbox>
  );
}
