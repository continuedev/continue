import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserSettingsSection } from "./UserSettingsSection";

// Same mock as renderWithProviders (headlessui needs ResizeObserver)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockPost = vi.fn();
const mockDispatch = vi.fn();

// Mock the dependencies, same style as FindAndReplace.test.tsx
vi.mock("../../../context/IdeMessenger", () => ({
  IdeMessengerContext: {
    _currentValue: { post: (...args: any[]) => mockPost(...args) },
  },
}));

vi.mock("../../../redux/hooks", () => ({
  useAppSelector: vi.fn(),
  useAppDispatch: () => mockDispatch,
}));

vi.mock("../../../components/ui", async () => {
  const actual = await vi.importActual<any>("../../../components/ui");
  return {
    ...actual,
    useFontSize: () => 14,
  };
});

import { useAppSelector } from "../../../redux/hooks";

const mockUseAppSelector = useAppSelector as any;

const mockConfig = {
  ui: {} as Record<string, unknown>,
  tabAutocompleteOptions: {},
  experimental: {},
  allowAnonymousTelemetry: true,
  disableSessionTitles: false,
};

function renderSection() {
  return render(<UserSettingsSection />);
}

function getRainbowToggle() {
  // The toggle track (click target) is the sibling element of the setting title,
  // the knob inside it carries the on/off styling
  const title = screen.getByText("Enable Rainbow Effect");
  const row = title.closest("div.gap-4") as HTMLElement;
  const track = row.querySelector(".rounded-full") as HTMLElement;
  const knob = track.querySelector("div") as HTMLElement;
  return { track, knob };
}

describe("UserSettingsSection - Enable Rainbow Effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.ui = {};
    mockUseAppSelector.mockImplementation((selector: any) =>
      selector({ config: { config: mockConfig } }),
    );
  });

  it("shows the toggle enabled by default when no config value is provided", () => {
    renderSection();

    expect(screen.getByText("Enable Rainbow Effect")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Show the animated rainbow border around the input box while Continue is processing.",
      ),
    ).toBeInTheDocument();

    // Default true => toggle knob has the "on" styling
    expect(getRainbowToggle().knob.className).toContain("brightness-150");
  });

  it("posts rainbowEffectEnabled: false to shared config when toggled off", () => {
    renderSection();

    fireEvent.click(getRainbowToggle().track);

    expect(mockPost).toHaveBeenCalledWith("config/updateSharedConfig", {
      rainbowEffectEnabled: false,
    });
    // Optimistic redux update is dispatched as well
    expect(mockDispatch).toHaveBeenCalled();
  });

  it("posts rainbowEffectEnabled: true when toggled back on", () => {
    mockConfig.ui = { rainbowEffectEnabled: false };

    renderSection();

    fireEvent.click(getRainbowToggle().track);

    expect(mockPost).toHaveBeenCalledWith("config/updateSharedConfig", {
      rainbowEffectEnabled: true,
    });
  });

  it("reflects an existing disabled value from config", () => {
    mockConfig.ui = { rainbowEffectEnabled: false };

    renderSection();

    // Default false => toggle knob has the "off" styling
    expect(getRainbowToggle().knob.className).toContain("brightness-75");
  });
});
