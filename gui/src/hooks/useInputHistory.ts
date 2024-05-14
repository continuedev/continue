import { JSONContent } from "@tiptap/react";
import { useState } from "react";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import useUpdatingRef from "./useUpdatingRef";

const emptyJsonContent = () => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
});

export function useInputHistory() {
  const [inputHistory, setInputHistory] = useState<JSONContent[]>(
    getLocalStorage("inputHistory") ?? [],
  );
  const [pendingInput, setPendingInput] = useState<JSONContent>(
    emptyJsonContent(),
  );
  const [currentIndex, setCurrentIndex] = useState(inputHistory.length);

  function prev(currentInput: JSONContent) {
    let index = currentIndex;

    if (index === inputHistory.length) {
      setPendingInput(currentInput);
    }

    if (index > 0 && index <= inputHistory.length) {
      setCurrentIndex((prevState) => prevState - 1);
      return inputHistory[index - 1];
    }
  }

  function next() {
    let index = currentIndex;
    if (index >= 0 && index < inputHistory.length) {
      setCurrentIndex((prevState) => prevState + 1);
      if (index === inputHistory.length - 1) {
        return pendingInput;
      }
      return inputHistory[index + 1];
    }
  }

  function add(inputValue: JSONContent) {
    setPendingInput(emptyJsonContent());

    if (
      JSON.stringify(inputHistory[inputHistory.length - 1]) ===
      JSON.stringify(inputValue)
    ) {
      setCurrentIndex(inputHistory.length);
      return;
    } else {
      setCurrentIndex(inputHistory.length + 1);
    }
    setInputHistory((prev) => {
      return [...prev, inputValue];
    });
    setLocalStorage("inputHistory", [...inputHistory, inputValue]);
  }

  const prevRef = useUpdatingRef(prev, [inputHistory]);
  const nextRef = useUpdatingRef(next, [inputHistory]);
  const addRef = useUpdatingRef(add, [inputHistory]);

  return { prevRef, nextRef, addRef };
}
