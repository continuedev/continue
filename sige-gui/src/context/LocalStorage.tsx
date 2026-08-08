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

  // Helper function to sync state with localStorage
  const syncWithLocalStorage = () => {
    const isJetbrains = getLocalStorage("ide") === "jetbrains";
    const fontSize = getLocalStorage("fontSize") ?? (isJetbrains ? 15 : 14);

    setValues((prev) => ({
      ...prev,
      fontSize,
    }));
  };

  // Initialize with values from localStorage
  useEffect(() => {
    syncWithLocalStorage();
  }, []);

  // Listen for current tab changes using CustomEvent
  useEffect(() => {
    const handleLocalStorageChange = (event: CustomEvent) => {
      if (event.detail?.key === "fontSize") {
        syncWithLocalStorage();
      }
    };

    window.addEventListener(
      "localStorageChange",
      handleLocalStorageChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "localStorageChange",
        handleLocalStorageChange as EventListener,
      );
    };
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
