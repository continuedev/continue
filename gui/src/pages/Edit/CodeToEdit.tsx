import { PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { removeCodeToEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEditListItem from "./CodeToEditListItem";
import { vscEditorBackground } from "../../components";
import { setShouldAddFileForEditing } from "../../redux/slices/uiStateSlice";
import { CodeToEdit, RangeInFileWithContents } from "core";

export default function WorkingSet() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const editModeState = useSelector((state: RootState) => state.editModeState);

  const hasCodeToEdit = editModeState.codeToEdit.length > 0;

  const addFileText = hasCodeToEdit ? "Add file" : "Add a file to get started";

  const title =
    editModeState.codeToEdit.length === 0
      ? "Code to edit"
      : editModeState.codeToEdit.length === 1
        ? "Code to edit (1 item)"
        : `Code to edit (${editModeState.codeToEdit.length} items)`;

  function onDelete(rif: RangeInFileWithContents) {
    dispatch(removeCodeToEdit(rif));
  }

  function onClickAddFileToCodeToEdit() {
    dispatch(setShouldAddFileForEditing(true));
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

  const codeToEditItems = [...editModeState.codeToEdit]
    .reverse()
    .map((code, i) => (
      <CodeToEditListItem
        key={code.filepath + i}
        code={code}
        onDelete={onDelete}
        onClickFilename={onClickFilename}
      />
    ));

  return (
    <div className="bg-vsc-editor-background border-vsc-input-border mx-1 flex flex-col rounded-t-lg border border-b-0 border-solid p-1">
      <div className="text-lightgray flex items-center justify-between gap-1.5 px-1 py-1.5 text-xs">
        <span>{title}</span>

        <span
          className="hover:bg-lightgray hover:text-vsc-foreground flex cursor-pointer items-center justify-between gap-1 rounded px-1 py-0.5 transition-colors hover:bg-opacity-20"
          onClick={onClickAddFileToCodeToEdit}
        >
          <PlusIcon className="inline h-3 w-3" />
          <span>{addFileText}</span>
        </span>
      </div>

      {hasCodeToEdit && (
        <ul className="scrollbar-hide mb-1.5 mt-1 max-h-[50vh] list-outside list-none space-y-1.5 overflow-y-auto pl-0">
          {codeToEditItems}
        </ul>
      )}
    </div>
  );
}
