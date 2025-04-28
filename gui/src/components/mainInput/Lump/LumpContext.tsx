/**
 * Provides context for controlling the Lump component's visibility state
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAppSelector } from "../../../redux/hooks";

interface LumpContextType {
  isLumpVisible: boolean;
  selectedSection: string | null;
  displayedSection: string | null;
  isToolbarExpanded: boolean;
  hideLump: () => void;
  setSelectedSection: (section: string | null) => void;
  toggleToolbar: () => void;
}

const LumpContext = createContext<LumpContextType | undefined>(undefined);

interface LumpProviderProps {
  children: ReactNode;
}

/**
 * Provider component that makes Lump state available to any child component
 */
export function LumpProvider({ children }: LumpProviderProps) {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [displayedSection, setDisplayedSection] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  const configError = useAppSelector((store) => store.config.configError);

  // Handle keyboard escape
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedSection) {
        setSelectedSection(null);
      }
    },
    [selectedSection],
  );

  // Function to hide the lump
  const hideLump = useCallback(() => {
    setSelectedSection(null);
  }, []);

  // Function to toggle toolbar expanded state
  const toggleToolbar = useCallback(() => {
    setIsToolbarExpanded((prev) => !prev);
  }, []);

  // Update displayedSection and visibility when selectedSection changes
  useEffect(() => {
    if (selectedSection) {
      setDisplayedSection(selectedSection);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setDisplayedSection(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [selectedSection]);

  // Don't allow selection error section if there are no errors
  useEffect(() => {
    if (selectedSection === "error" && !configError) {
      setSelectedSection(null);
    }
  }, [selectedSection, configError]);

  // Reset when streaming starts
  useEffect(() => {
    if (isStreaming && selectedSection) {
      setSelectedSection(null);
    }
  }, [isStreaming, selectedSection]);

  // Set up keyboard listener
  useEffect(() => {
    if (selectedSection) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedSection, handleKeyDown]);

  return (
    <LumpContext.Provider
      value={{
        isLumpVisible: isVisible,
        selectedSection,
        displayedSection,
        isToolbarExpanded,
        hideLump,
        setSelectedSection,
        toggleToolbar,
      }}
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
