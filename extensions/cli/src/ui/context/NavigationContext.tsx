import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useReducer,
} from "react";

/**
 * Navigation screens for the UI
 * Only one screen can be active at a time
 */
export type NavigationScreen =
  | "chat" // Normal chat interface
  | "config" // Config selector (includes organization switching)
  | "model" // Model selector
  | "free-trial" // Free trial transition UI
  | "login" // Login prompt
  | "mcp" // MCP selector
  | "session" // Session selector
  | "diff" // Full-screen diff overlay
  | "update" // Update selector
  | "edit" // Edit message selector
  | "session"; // Session selector

interface NavigationState {
  currentScreen: NavigationScreen;
  // Screen-specific data (e.g., login prompt details)
  screenData?: any;
}

/**
 * Navigation actions
 */
type NavigationAction =
  | { type: "NAVIGATE_TO"; screen: NavigationScreen; data?: any }
  | { type: "CLOSE_SCREEN" };

/**
 * Navigation reducer - handles all state transitions deterministically
 */
function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "NAVIGATE_TO":
      return {
        currentScreen: action.screen,
        screenData: action.data ?? null,
      };

    case "CLOSE_SCREEN":
      return {
        currentScreen: "chat",
        screenData: null,
      };

    default:
      return state;
  }
}

interface NavigationContextValue {
  // Current navigation state
  state: NavigationState;

  // Navigation methods
  navigateTo: (screen: NavigationScreen, data?: any) => void;
  closeCurrentScreen: () => void;

  // Check if a specific screen is active
  isScreenActive: (screen: NavigationScreen) => boolean;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined,
);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [state, dispatch] = useReducer(navigationReducer, {
    currentScreen: "chat",
    screenData: null,
  });

  const navigateTo = useCallback((screen: NavigationScreen, data?: any) => {
    dispatch({ type: "NAVIGATE_TO", screen, data });
  }, []);

  const closeCurrentScreen = useCallback(() => {
    dispatch({ type: "CLOSE_SCREEN" });
  }, []);

  const isScreenActive = useCallback(
    (screen: NavigationScreen): boolean => {
      return state.currentScreen === screen;
    },
    [state.currentScreen],
  );

  const value: NavigationContextValue = {
    state,
    navigateTo,
    closeCurrentScreen,
    isScreenActive,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
