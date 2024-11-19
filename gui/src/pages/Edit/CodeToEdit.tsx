import { InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { removeEntryFromCodeToEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEditListItem from "./CodeToEditListItem";
import { RangeInFileWithContents } from "core/commands/util";
import { vscEditorBackground } from "../../components";

export default function WorkingSet() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const editModeState = useSelector((state: RootState) => state.editModeState);

  const hasCodeToEdit = editModeState.codeToEdit.length > 0;

  function onDelete(rif: RangeInFileWithContents) {
    dispatch(removeEntryFromCodeToEdit(rif));
  }

  function onClickAddFileToCodeToEdit() {}

  function onClickCodeToEditItem(rif: RangeInFileWithContents) {
    const { filepath, range } = editModeState.codeToEdit.find(
      (workingSetRIF) => workingSetRIF === rif,
    );

    ideMessenger.ide.showLines(filepath, range.start.line, range.end.line);
  }

  const codeToEditItems = editModeState.codeToEdit.map((rif) => (
    <CodeToEditListItem
      key={rif.filepath + rif.range.start.line + rif.range.end.line}
      rif={rif}
      onDelete={onDelete}
      onClick={onClickCodeToEditItem}
    />
  ));

  return (
    <div
      className="mx-1 rounded-t-lg px-1 pb-1"
      style={{ backgroundColor: vscEditorBackground }}
    >
      <div className="flex items-center justify-between gap-1.5 border-0 border-b border-solid border-zinc-600 px-1 py-1.5 text-xs text-zinc-400">
        <div className="flex items-center justify-between gap-1.5">
          <span>Code to edit</span>
          <InformationCircleIcon className="inline h-3 w-3 cursor-pointer" />
        </div>

        <span
          className="flex cursor-pointer items-center justify-between gap-1 rounded px-1 py-0.5 transition-colors hover:bg-white/10"
          onClick={onClickAddFileToCodeToEdit}
        >
          <PlusIcon className="inline h-3 w-3" />
          <span>Add file</span>
        </span>
      </div>

      {hasCodeToEdit ? (
        <ul className="my-1.5 list-outside list-none space-y-1 pl-0">
          {codeToEditItems}
        </ul>
      ) : (
        <span
          className="my-1.5 flex cursor-pointer items-center gap-1 rounded p-1 transition-colors hover:bg-white/10"
          onClick={onClickAddFileToCodeToEdit}
        >
          <PlusIcon className="inline h-3 w-3" />
          <span>Add a file to get started</span>
        </span>
      )}
    </div>
  );
}
