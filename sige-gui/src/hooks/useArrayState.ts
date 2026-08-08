import { useState } from "react";

function useArrayState<T>(initialValue: T[]) {
  const [value, setValue] = useState(initialValue);

  function add(item: any) {
    setValue((prev) => [...prev, item]);
  }

  function remove(index: number) {
    setValue((prev) => prev.filter((_, i) => i !== index));
  }

  function edit(editFn: (prev: T[]) => T[]) {
    setValue((prev) => editFn(prev));
  }

  function replace(atIndex: number, withItem: T) {
    setValue((prev) => {
      let updated = [...prev];
      updated[atIndex] = withItem;
      return updated;
    });
  }

  return { value, add, remove, edit, replace };
}

export default useArrayState;
