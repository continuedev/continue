import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { removeCodeToEdit } from "../../redux/slices/editModeState";
import { RootState } from "../../redux/store";
import CodeToEditListItem from "./CodeToEditListItem";

import { CodeToEdit, RangeInFileWithContents } from "core";
import AddFileButton from "./AddFileButton";

export default function WorkingSet() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const codeToEdit = useSelector(
    (state: RootState) => state.editModeState.codeToEdit,
  );

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

  const codeToEditItems = [...codeToEdit]
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
    <div className="bg-vsc-editor-background mx-1 flex flex-col rounded-t-lg p-1">
      <div className="text-lightgray flex items-center justify-between gap-1.5 py-1.5 pl-3 pr-2 text-xs">
        <span>{title}</span>
        <AddFileButton />
      </div>

      {codeToEdit.length > 0 && (
        <ul className="no-scrollbar mb-1.5 mt-1 max-h-[50vh] list-outside list-none overflow-y-auto pl-0">
          {codeToEditItems}
        </ul>
      )}
    </div>
  );
}
