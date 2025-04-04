/**
 * Provides context for controlling the Lump component's visibility state
 */
import { createContext, ReactNode, useContext } from "react";

interface LumpContextType {
  isLumpVisible: boolean;
  selectedSection: string | null;
  hideLump: () => void;
  setSelectedSection: (section: string | null) => void;
}

const LumpContext = createContext<LumpContextType | undefined>(undefined);

interface LumpProviderProps {
  children: ReactNode;
  isLumpVisible: boolean;
  selectedSection: string | null;
  hideLump: () => void;
  setSelectedSection: (section: string | null) => void;
}

/**
 * Provider component that makes Lump state available to any child component
 */
export function LumpProvider({
  children,
  isLumpVisible,
  selectedSection,
  hideLump,
  setSelectedSection,
}: LumpProviderProps) {
  return (
    <LumpContext.Provider
      value={{ isLumpVisible, selectedSection, hideLump, setSelectedSection }}
    >
      {children}
    </LumpContext.Provider>
  );
}

/**
 * Hook that lets any component access the Lump context
 */
export function useLump() {
  const context = useContext(LumpContext);
  if (context === undefined) {
    throw new Error("useLump must be used within a LumpProvider");
  }
  return context;
}
