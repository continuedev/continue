import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  IdeMessengerContext,
  type IIdeMessenger,
} from "../../context/IdeMessenger";
import StreamErrorDialog from "./StreamError";

// Avoid pulling in core's native deps (uri-js, uuid, etc.)
vi.mock("../../redux/thunks/streamResponse", () => ({
  streamResponseThunk: vi.fn(),
}));

vi.mock("../../components/mainInput/Lump/useEditBlock", () => ({
  useEditModel: () => vi.fn(),
}));

vi.mock("../../components/mainInput/TipTapEditor", () => ({
  useMainEditor: () => ({ mainEditor: null }),
  MainEditorProvider: ({ children }: any) => children,
}));

vi.mock("../../context/Auth", () => ({
  useAuth: () => ({
    session: null,
    selectedProfile: null,
    refreshProfiles: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("../../components/ToggleDiv", () => ({
  default: ({ children, title }: any) => (
    <div>
      <span>{title}</span>
      {children}
    </div>
  ),
}));

// Mock Redux hooks so we control selectedModel without a full store
const mockDispatch = vi.fn();
let mockSelectedModel: object | null = null;
let mockSelectedProfile: object | null = null;
let mockHistory: any[] = [];

vi.mock("../../redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => {
    // Return values based on what selectors are asking for
    const state = {
      config: {
        selectedModelByRole: { chat: mockSelectedModel },
        config: { models: [] },
      },
      session: { history: mockHistory, isInEdit: false },
      profiles: {
        organizations: [],
        selectedOrgId: null,
      },
    };
    try {
      return selector(state);
    } catch {
      return undefined;
    }
  },
}));

// Also mock the individual selectors used directly
vi.mock("../../redux/slices/configSlice", () => ({
  selectSelectedChatModel: (state: any) =>
    state?.config?.selectedModelByRole?.chat ?? null,
}));

vi.mock("../../redux/slices/profilesSlice", () => ({
  selectSelectedProfile: (state: any) => state?.profiles?.selectedOrgId ?? null,
}));

vi.mock("../../redux/slices/uiSlice", () => ({
  setDialogMessage: vi.fn(() => ({ type: "ui/setDialogMessage" })),
  setShowDialog: vi.fn(() => ({ type: "ui/setShowDialog" })),
}));

function createMockMessenger(): IIdeMessenger {
  return {
    post: vi.fn(),
    request: vi.fn(),
    respond: vi.fn(),
    streamRequest: vi.fn(),
    ide: { openUrl: vi.fn() } as any,
  } as any;
}

function renderError(error: unknown, selectedModel: object | null = null) {
  mockSelectedModel = selectedModel;
  const messenger = createMockMessenger();
  render(
    <IdeMessengerContext.Provider value={messenger}>
      <StreamErrorDialog error={error} />
    </IdeMessengerContext.Provider>,
  );
  return { messenger };
}

describe("StreamErrorDialog", () => {
  describe("OutOfCreditsDialog routing", () => {
    it('shows OutOfCreditsDialog for "You have no credits remaining on your Continue account"', () => {
      renderError(
        new Error("You have no credits remaining on your Continue account"),
      );
      expect(
        screen.getByText(
          "You have no credits remaining on your Continue account",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Purchase Credits")).toBeInTheDocument();
      expect(screen.getByText("Add API key secret")).toBeInTheDocument();
    });

    it('shows OutOfCreditsDialog for legacy "You\'re out of credits!" string', () => {
      renderError(new Error("You're out of credits!"));
      expect(screen.getByText("Purchase Credits")).toBeInTheDocument();
    });

    it("generic 402 does NOT show OutOfCreditsDialog — uses customErrorMessage instead", () => {
      renderError(new Error("402 Payment Required"));
      expect(screen.queryByText("Purchase Credits")).not.toBeInTheDocument();
      expect(screen.getByText(/out of credits/i)).toBeInTheDocument();
    });
  });

  describe("customErrorMessage display", () => {
    it("shows invalid API key message for 'Invalid API Key'", () => {
      renderError(new Error("Invalid API Key"));
      expect(
        screen.getByText(/API key is actually invalid/i),
      ).toBeInTheDocument();
    });

    it("shows invalid API key message for 'Incorrect API key provided'", () => {
      renderError(
        new Error(
          '401 Unauthorized\n\n{"error": {"message": "Incorrect API key provided"}}',
        ),
      );
      expect(
        screen.getByText(/API key is actually invalid/i),
      ).toBeInTheDocument();
    });

    it("includes provider name in 402 customErrorMessage", () => {
      renderError(new Error("402 Payment Required"), {
        title: "DeepSeek Chat",
        underlyingProviderName: "deepseek",
      });
      expect(screen.getByText(/deepseek/i)).toBeInTheDocument();
      expect(screen.getByText(/out of credits/i)).toBeInTheDocument();
    });

    it("shows helpUrl button for OpenAI org verification error", () => {
      renderError(
        new Error(
          "openai organization must be verified to generate reasoning summaries",
        ),
      );
      expect(screen.getByText("View help documentation")).toBeInTheDocument();
    });

    it("shows 'Check API key' button when apiKeyUrl available for invalid key", () => {
      renderError(new Error("Invalid API Key"), {
        title: "GPT-4",
        underlyingProviderName: "openai",
      });
      expect(screen.getByText("Check API key")).toBeInTheDocument();
    });
  });

  describe("standard status code errors", () => {
    it("shows rate limit message for 429", () => {
      renderError(new Error("429 Too Many Requests"));
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });

    it("shows not-found hints for 404", () => {
      renderError(new Error("404 Not Found"));
      expect(screen.getByText("Likely causes:")).toBeInTheDocument();
      expect(
        screen.getByText("Model/deployment not found"),
      ).toBeInTheDocument();
    });

    it("shows generic error title for unknown errors", () => {
      renderError(new Error("Something unexpected happened"));
      expect(
        screen.getByText("Error handling model response"),
      ).toBeInTheDocument();
    });

    it("shows Resubmit button for generic errors", () => {
      renderError(new Error("Something unexpected happened"));
      expect(screen.getByText("Resubmit last message")).toBeInTheDocument();
    });
  });

  describe("error output section", () => {
    it("shows 'View error output' toggle when there is an error message", () => {
      renderError(new Error("429 Too Many Requests"));
      expect(screen.getByText("View error output")).toBeInTheDocument();
    });
  });
});
