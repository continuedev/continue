import { ContextSubmenuItemWithProvider } from "core";
import { useEffect, useRef, useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "../../components/ui/Combobox";
import { useSubmenuContextProviders } from "../../context/SubmenuContextProviders";
import { useAppSelector } from "../../redux/hooks";
import FileIcon from "../FileIcon";
export interface AddFileComboboxProps {
  onSelect: (filepaths: string[]) => void | Promise<void>;
  onEscape: () => void | Promise<void>;
}

export default function AddFileCombobox({
  onSelect,
  onEscape,
}: AddFileComboboxProps) {
  const [query, setQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<
    ContextSubmenuItemWithProvider[]
  >([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { getSubmenuContextItems } = useSubmenuContextProviders();
  const allFiles = getSubmenuContextItems("file", "");
  const codeToEdit = useAppSelector((state) => state.session.codeToEdit);
  const remainingFiles = allFiles.filter(
    (file) => !codeToEdit.find((code) => code.filepath === file.id),
  );

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const filteredFiles =
    query === ""
      ? remainingFiles
      : remainingFiles.filter((file) =>
          file.title.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <div className="pb-2 pl-3.5 pr-2">
      <Combobox
        multiple
        value={selectedFiles}
        onChange={(files) => {
          setSelectedFiles(files);
          void onSelect(files.map((file) => file.id));
          buttonRef.current?.click();
        }}
      >
        {({ open }) => (
          <div className="relative">
            <ComboboxButton className="hidden" ref={buttonRef} />
            <ComboboxInput
              ref={inputRef}
              onClick={() => {
                if (!open) {
                  buttonRef.current?.click();
                }
              }}
              onFocus={() => {
                buttonRef.current?.click();
              }}
              className="bg-vsc-background border-lightgray text-vsc-foreground box-border w-full rounded border border-solid py-0.5 pl-2 text-xs focus:outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search files..."
              onKeyDown={(e) => {
                if (e.key === "Escape" && !open) {
                  void onEscape();
                }
              }}
            />

            <ComboboxOptions className="no-scrollbar bg-vsc-editor-background border-lightgray/50 absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-solid px-1 py-0 pl-0 pr-5 shadow-lg focus:outline-none">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((file) => (
                  <ComboboxOption
                    key={file.id}
                    value={file}
                    className={({ active }) =>
                      `relative flex w-full cursor-pointer px-2 py-1 text-left text-xs ${
                        active
                          ? "bg-list-active text-list-active-foreground"
                          : ""
                      }`
                    }
                  >
                    {({ active, selected }) => (
                      <div className="group flex w-full min-w-0 items-center gap-1">
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          <FileIcon
                            height="20px"
                            width="20px"
                            filename={file.title}
                          />
                          <span className="truncate">{file.title}</span>
                        </div>

                        <span
                          className={`text-lightgray max-w-[30%] truncate ${
                            active || selected ? "visible" : "invisible"
                          } group-hover:visible`}
                        >
                          {file.description}
                        </span>
                      </div>
                    )}
                  </ComboboxOption>
                ))
              ) : (
                <div className="text-list-active-foreground px-2 py-1 text-xs">
                  No results
                </div>
              )}
            </ComboboxOptions>
          </div>
        )}
      </Combobox>
    </div>
  );
}
