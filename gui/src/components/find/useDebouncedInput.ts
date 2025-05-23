import { debounce } from "lodash";
import { useEffect, useRef, useState } from "react";

interface UseDebouncedInputResult {
  inputRef: React.RefObject<HTMLInputElement>;
  debouncedValue: string;
  currentValue: string;
}

export const useDebouncedInput = (
  debounceDelay: number = 300,
): UseDebouncedInputResult => {
  const [debouncedValue, setDebouncedValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSetValue = useRef(
    debounce((value: string) => {
      setDebouncedValue(value);
    }, debounceDelay),
  ).current;

  useEffect(() => {
    debouncedSetValue(currentValue);
    // Initial value is set immediately
    if (currentValue === "") {
      setDebouncedValue("");
    }

    return () => {
      debouncedSetValue.cancel();
    };
  }, [currentValue, debouncedSetValue]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleChange = (event: Event) => {
      setCurrentValue((event.target as HTMLInputElement).value);
    };

    input.addEventListener("input", handleChange);
    return () => input.removeEventListener("input", handleChange);
  }, []);

  return { inputRef, debouncedValue, currentValue };
};
