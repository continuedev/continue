import { useState, useEffect, useRef } from "react";
import {
  ContextSubmenuItemWithProvider,
  useSubmenuContextProviders,
} from "../../context/SubmenuContextProviders";
import { Combobox } from "@headlessui/react";
import FileIcon from "../FileIcon";
import { useAppSelector } from "../../redux/hooks";

export interface AddFileComboboxProps {
  onSelect: (filepaths: string[]) => void;
  onEscape: () => void;
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
          onSelect(files.map((file) => file.id));
          buttonRef.current?.click();
        }}
      >
        {({ open }) => (
          <div className="relative">
            <Combobox.Button className="hidden" ref={buttonRef} />
            <Combobox.Input
              ref={inputRef}
              onClick={() => {
                if (!open) {
                  buttonRef.current?.click();
                }
              }}
              onFocus={() => {
                buttonRef.current?.click();
              }}
              className="bg-vsc-background border-lightgray text-vsc-foreground box-border w-full rounded border border-solid py-0.5 pl-2 focus:outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search files..."
              onKeyDown={(e) => {
                if (e.key === "Escape" && !open) {
                  onEscape();
                }
              }}
            />

            <Combobox.Options className="no-scrollbar bg-vsc-editor-background border-lightgray/50 absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-solid px-1 py-0 pl-0 pr-5 shadow-lg focus:outline-none">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((file) => (
                  <Combobox.Option
                    key={file.id}
                    value={file}
                    className={({ active }) =>
                      `relative flex w-full cursor-pointer px-2 py-1 text-left text-xs ${
                        active
                          ? "bg-vsc-list-active-background text-vsc-list-active-foreground"
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
                  </Combobox.Option>
                ))
              ) : (
                <div className="text-vsc-list-active-foreground0 px-2 py-1 text-xs">
                  No results
                </div>
              )}
            </Combobox.Options>
          </div>
        )}
      </Combobox>
    </div>
  );
}
