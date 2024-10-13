import React, { createContext, useState } from "react";

export const LastSessionContext = createContext<{
  lastSessionId: string | undefined;
  setLastSessionId: (id: string | undefined) => void;
}>({
  lastSessionId: undefined,
  setLastSessionId: () => {},
});

export const LastSessionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [lastSessionId, setLastSessionId] = useState<string | undefined>();

  return (
    <LastSessionContext.Provider value={{ lastSessionId, setLastSessionId }}>
      {children}
    </LastSessionContext.Provider>
  );
};

export const useLastSessionContext = () => React.useContext(LastSessionContext);
