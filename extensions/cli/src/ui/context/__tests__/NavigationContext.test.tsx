/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import {
  NavigationProvider,
  useNavigation,
  NavigationScreen,
} from "../NavigationContext.js";

describe("NavigationContext", () => {
  // Helper to create wrapper
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationProvider>{children}</NavigationProvider>
  );

  describe("NavigationProvider", () => {
    it("provides navigation context to children", () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.state).toBeDefined();
      expect(result.current.navigateTo).toBeDefined();
      expect(result.current.closeCurrentScreen).toBeDefined();
      expect(result.current.isScreenActive).toBeDefined();
    });

    it("initializes with chat as the current screen", () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.state.currentScreen).toBe("chat");
      expect(result.current.state.screenData).toBeNull();
    });

    it("throws error when useNavigation is used outside provider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useNavigation());
      }).toThrow("useNavigation must be used within NavigationProvider");

      console.error = originalError;
    });
  });

  describe("Navigation Actions", () => {
    describe("navigateTo", () => {
      it("navigates to a new screen", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        act(() => {
          result.current.navigateTo("config");
        });

        expect(result.current.state.currentScreen).toBe("config");
      });

      it("navigates to a new screen with data", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const testData = { text: "Login required", resolve: vi.fn() };

        act(() => {
          result.current.navigateTo("login", testData);
        });

        expect(result.current.state.currentScreen).toBe("login");
        expect(result.current.state.screenData).toEqual(testData);
      });

      it("can navigate to all valid screens", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const screens: NavigationScreen[] = [
          "chat",
          "config",
          "model",
          "free-trial",
          "login",
          "mcp",
        ];

        screens.forEach((screen) => {
          act(() => {
            result.current.navigateTo(screen);
          });
          expect(result.current.state.currentScreen).toBe(screen);
        });
      });

      it("replaces screen data when navigating to the same screen", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const firstData = { value: 1 };
        const secondData = { value: 2 };

        act(() => {
          result.current.navigateTo("login", firstData);
        });
        expect(result.current.state.screenData).toEqual(firstData);

        act(() => {
          result.current.navigateTo("login", secondData);
        });
        expect(result.current.state.screenData).toEqual(secondData);
      });

      it("clears screen data when navigating without data", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const testData = { value: "test" };

        act(() => {
          result.current.navigateTo("login", testData);
        });
        expect(result.current.state.screenData).toEqual(testData);

        act(() => {
          result.current.navigateTo("config");
        });
        expect(result.current.state.screenData).toBeNull();
      });
    });

    describe("closeCurrentScreen", () => {
      it("returns to chat screen when closing other screens", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        act(() => {
          result.current.navigateTo("config");
        });
        expect(result.current.state.currentScreen).toBe("config");

        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.state.currentScreen).toBe("chat");
      });

      it("clears screen data when closing", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const testData = { text: "Test data" };

        act(() => {
          result.current.navigateTo("login", testData);
        });
        expect(result.current.state.screenData).toEqual(testData);

        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.state.screenData).toBeNull();
      });

      it("stays on chat screen when closing from chat", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        expect(result.current.state.currentScreen).toBe("chat");

        act(() => {
          result.current.closeCurrentScreen();
        });

        expect(result.current.state.currentScreen).toBe("chat");
      });

      it("closes from any screen back to chat", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const screens: Array<
          "config" | "model" | "free-trial" | "login" | "mcp"
        > = ["config", "model", "free-trial", "login", "mcp"];

        screens.forEach((screen) => {
          act(() => {
            result.current.navigateTo(screen);
          });
          expect(result.current.state.currentScreen).toBe(screen);

          act(() => {
            result.current.closeCurrentScreen();
          });
          expect(result.current.state.currentScreen).toBe("chat");
        });
      });
    });

    describe("isScreenActive", () => {
      it("returns true for active screen", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        expect(result.current.isScreenActive("chat")).toBe(true);

        act(() => {
          result.current.navigateTo("config");
        });

        expect(result.current.isScreenActive("config")).toBe(true);
        expect(result.current.isScreenActive("chat")).toBe(false);
      });

      it("returns false for inactive screens", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        expect(result.current.isScreenActive("config")).toBe(false);
        expect(result.current.isScreenActive("model")).toBe(false);
        expect(result.current.isScreenActive("mcp")).toBe(false);
        expect(result.current.isScreenActive("free-trial")).toBe(false);
        expect(result.current.isScreenActive("login")).toBe(false);
      });

      it("updates correctly when navigating", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        act(() => {
          result.current.navigateTo("free-trial");
        });
        expect(result.current.isScreenActive("free-trial")).toBe(true);

        act(() => {
          result.current.navigateTo("model");
        });
        expect(result.current.isScreenActive("free-trial")).toBe(false);
        expect(result.current.isScreenActive("model")).toBe(true);

        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.isScreenActive("model")).toBe(false);
        expect(result.current.isScreenActive("chat")).toBe(true);
      });
    });

    describe("State Management", () => {
      it("maintains immutable state updates", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const initialState = result.current.state;

        act(() => {
          result.current.navigateTo("config");
        });

        expect(result.current.state).not.toBe(initialState);
        expect(result.current.state.currentScreen).toBe("config");
      });

      it("preserves unrelated state when updating", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        act(() => {
          result.current.navigateTo("login", { custom: "data" });
        });

        const stateWithData = result.current.state;

        act(() => {
          result.current.navigateTo("login", { different: "data" });
        });

        expect(result.current.state.currentScreen).toBe(
          stateWithData.currentScreen,
        );
        expect(result.current.state.screenData).not.toBe(
          stateWithData.screenData,
        );
      });
    });

    describe("Integration Scenarios", () => {
      it("handles login flow correctly", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });
        const mockResolve = vi.fn();

        // Navigate to login with resolve callback
        act(() => {
          result.current.navigateTo("login", {
            text: "Please log in",
            resolve: mockResolve,
          });
        });

        expect(result.current.state.currentScreen).toBe("login");
        expect(result.current.state.screenData?.text).toBe("Please log in");
        expect(result.current.state.screenData?.resolve).toBe(mockResolve);

        // Close login screen (simulating successful login)
        act(() => {
          result.current.closeCurrentScreen();
        });

        expect(result.current.state.currentScreen).toBe("chat");
        expect(result.current.state.screenData).toBeNull();
      });

      it("handles config selection flow (now includes organization switching)", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        // Navigate to config selector
        act(() => {
          result.current.navigateTo("config");
        });
        expect(result.current.isScreenActive("config")).toBe(true);

        // Close after selection
        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.isScreenActive("chat")).toBe(true);
      });

      it("handles free trial transition flow", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        // Show free trial screen
        act(() => {
          result.current.navigateTo("free-trial");
        });
        expect(result.current.isScreenActive("free-trial")).toBe(true);

        // User might navigate to config from free trial
        act(() => {
          result.current.navigateTo("config");
        });
        expect(result.current.isScreenActive("config")).toBe(true);
        expect(result.current.isScreenActive("free-trial")).toBe(false);

        // Return to chat
        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.isScreenActive("chat")).toBe(true);
      });

      it("handles model switching flow", () => {
        const { result } = renderHook(() => useNavigation(), { wrapper });

        // Navigate to model selector
        act(() => {
          result.current.navigateTo("model");
        });
        expect(result.current.state.currentScreen).toBe("model");

        // Close after selection
        act(() => {
          result.current.closeCurrentScreen();
        });
        expect(result.current.state.currentScreen).toBe("chat");
      });
    });
  });
});
