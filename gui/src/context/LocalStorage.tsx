import React, { createContext, useContext, useEffect, useState } from "react";
import { getLocalStorage } from "../util/localStorage";

interface LocalStorageType {
  fontSize: number;
}

const DEFAULT_LOCAL_STORAGE: LocalStorageType = {
  fontSize: 14,
};

const LocalStorageContext = createContext<LocalStorageType>(
  DEFAULT_LOCAL_STORAGE,
);

export const LocalStorageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [values, setValues] = useState<LocalStorageType>(DEFAULT_LOCAL_STORAGE);

  // TODO setvalue
  useEffect(() => {
    const isJetbrains = getLocalStorage("ide") === "jetbrains";
    let fontSize = getLocalStorage("fontSize") ?? (isJetbrains ? 15 : 14);
    setValues({
      fontSize,
    });
  }, []);

  return (
    <LocalStorageContext.Provider value={values}>
      {children}
    </LocalStorageContext.Provider>
  );
};

export const useLocalStorage = () => {
  const context = useContext(LocalStorageContext);
  return context;
};
