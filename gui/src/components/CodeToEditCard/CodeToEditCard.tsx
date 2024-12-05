import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import CodeToEditListItem from "./CodeToEditListItem";
import type { CodeToEdit, RangeInFileWithContents } from "core";
import AddFileButton from "./AddFileButton";
import AddFileCombobox from "./AddFileCombobox";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAppSelector } from "../../redux/hooks";
import {
  addCodeToEdit,
  removeCodeToEdit,
} from "../../redux/slices/sessionSlice";

export default function CodeToEditCard() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [showAddFileCombobox, setShowAddFileCombobox] = useState(false);
  const codeToEdit = useAppSelector((state) => state.session.codeToEdit);

  const title =
    codeToEdit.length === 0
      ? "Code to edit"
      : codeToEdit.length === 1
        ? "Code to edit (1 item)"
        : `Code to edit (${codeToEdit.length} items)`;

  function onDelete(rif: RangeInFileWithContents) {
    dispatch(removeCodeToEdit(rif));
  }

  function onClickFilename(code: CodeToEdit) {
    if ("range" in code) {
      ideMessenger.ide.showLines(
        code.filepath,
        code.range.start.line,
        code.range.end.line,
      );
    } else {
      ideMessenger.ide.openFile(code.filepath);
    }
  }

  async function onSelectFilesToAdd(filepaths: string[]) {
    const filePromises = filepaths.map(async (filepath) => {
      const contents = await ideMessenger.ide.readFile(filepath);
      return { contents, filepath };
    });

    const fileResults = await Promise.all(filePromises);

    for (const file of fileResults) {
      dispatch(addCodeToEdit(file));
    }
  }

  return (
    <div className="bg-vsc-editor-background mx-3 flex flex-col rounded-t-lg p-1">
      <div className="text-lightgray flex items-center justify-between gap-1.5 py-1.5 pl-3 pr-2 text-xs">
        <span>{title}</span>
        <AddFileButton onClick={() => setShowAddFileCombobox(true)} />
      </div>

      {codeToEdit.length > 0 ? (
        <ul className="no-scrollbar my-0 mb-1.5 max-h-[50vh] list-outside list-none overflow-y-auto pl-0">
          {codeToEdit.map((code, i) => (
            <CodeToEditListItem
              key={code.filepath + i}
              code={code}
              onDelete={onDelete}
              onClickFilename={onClickFilename}
            />
          ))}
        </ul>
      ) : (
        !showAddFileCombobox && (
          <div
            className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground -mt-0.5 flex cursor-pointer items-center justify-center gap-1 rounded py-1 text-center text-xs transition-colors hover:bg-opacity-20"
            onClick={() => setShowAddFileCombobox(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add a file to get started</span>
          </div>
        )
      )}

      {showAddFileCombobox && (
        <div className="mr-2 flex items-center py-1">
          <div className="flex-grow">
            <AddFileCombobox
              onSelect={onSelectFilesToAdd}
              onEscape={() => setShowAddFileCombobox(false)}
            />
          </div>
          <XMarkIcon
            onClick={(e) => {
              setShowAddFileCombobox(false);
            }}
            className="text-lightgray hover:bg-lightgray hover:text-vsc-foreground mb-2 h-3.5 w-3.5 cursor-pointer rounded-md rounded-sm p-0.5 hover:bg-opacity-20"
          />
        </div>
      )}
    </div>
  );
}
