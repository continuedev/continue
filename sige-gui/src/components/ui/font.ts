import { useMemo } from "react";
import { useLocalStorage } from "../../context/LocalStorage";

export type FontSizeModifier = number | ((fontSize: number) => number);

export const useFontSize = (modifier?: FontSizeModifier) => {
  const { fontSize } = useLocalStorage();
  return useMemo(() => {
    return !modifier
      ? fontSize
      : typeof modifier === "number"
        ? fontSize + modifier
        : modifier(fontSize);
  }, [fontSize]);
};
