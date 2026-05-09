import { act, screen, waitFor } from "@testing-library/react";
import { TabBar } from "../../../components/TabBar/TabBar";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { updateConfig } from "../../../redux/slices/configSlice";
import { addAndSelectMockLlm } from "../../../util/test/config";
import {
  createMockStore,
  getEmptyRootState,
} from "../../../util/test/mockStore";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getElementByText,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

test("should render input box", async () => {
  await renderWithProviders(<Chat />);
  await getElementByTestId("continue-input-box-main-editor-input");
  await getElementByTestId("runtime-target-pill");
  expect(screen.getAllByTestId("assistant-select-button")).toHaveLength(1);
});

test("should switch runtime target from local to cloud", async () => {
  const initialState = getEmptyRootState();
  initialState.profiles.organizations = [
    {
      id: "personal",
      name: "Personal",
      slug: "personal",
      iconUrl: "",
      selectedProfileId: "local",
      profiles: [
        {
          title: "Local Agent",
          id: "local",
          errors: [],
          profileType: "local",
          uri: "",
          iconUrl: "",
          fullSlug: {
            ownerSlug: "",
            packageSlug: "",
            versionSlug: "",
          },
        },
      ],
    },
    {
      id: "team",
      name: "Team",
      slug: "team",
      iconUrl: "",
      selectedProfileId: "cloud-profile",
      profiles: [
        {
          title: "Cloud Agent",
          id: "cloud-profile",
          errors: [],
          profileType: "platform",
          uri: "",
          iconUrl: "",
          fullSlug: {
            ownerSlug: "team",
            packageSlug: "cloud-agent",
            versionSlug: "v1",
          },
        },
      ],
    },
  ];
  initialState.profiles.selectedOrganizationId = "personal";
  initialState.profiles.selectedProfileId = "local";

  const store = createMockStore(initialState);
  const mockIdeMessenger = new MockIdeMessenger();
  mockIdeMessenger.responses["config/getSerializedProfileInfo"] = {
    organizations: initialState.profiles.organizations,
    selectedOrgId: "personal",
    profileId: "local",
    result: {
      config: store.getState().config.config,
      errors: [],
      configLoadInterrupted: false,
    },
  };

  const { user } = await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  expect(screen.getByTestId("runtime-target-pill")).toHaveTextContent("Local");

  await user.click(screen.getByTestId("runtime-target-pill"));
  await user.click(screen.getByTestId("runtime-target-option-cloud"));

  await waitFor(() => {
    expect(screen.getByTestId("runtime-target-pill")).toHaveTextContent(
      "Cloud",
    );
    expect(store.getState().profiles.selectedOrganizationId).toBe("team");
    expect(store.getState().profiles.selectedProfileId).toBe("cloud-profile");
  });
});

test("should render pending edits above the composer", async () => {
  const initialState = getEmptyRootState();
  initialState.session.codeBlockApplyStates.states = [
    {
      streamId: "apply-1",
      status: "done",
      filepath: "/workspace/src/pending.ts",
      toolCallId: "tool-call-1",
    },
  ];

  const store = createMockStore(initialState);
  await renderWithProviders(<Chat />, { store });

  expect(screen.getByTestId("pending-apply-rail")).toBeInTheDocument();
  expect(screen.getByText("Pending edits")).toBeInTheDocument();
  expect(screen.getByText("pending.ts")).toBeInTheDocument();
  expect(screen.getByText("Undo")).toBeInTheDocument();
  expect(screen.getByText("Keep")).toBeInTheDocument();
});

test("should render batch pending edit actions for multiple files", async () => {
  const initialState = getEmptyRootState();
  initialState.session.codeBlockApplyStates.states = [
    {
      streamId: "apply-1",
      status: "done",
      filepath: "/workspace/src/first.ts",
      toolCallId: "tool-call-1",
    },
    {
      streamId: "apply-2",
      status: "done",
      filepath: "/workspace/src/second.ts",
      toolCallId: "tool-call-2",
    },
  ];

  const store = createMockStore(initialState);
  await renderWithProviders(<Chat />, { store });

  expect(screen.getByTestId("pending-apply-summary")).toHaveTextContent(
    "2 files",
  );
  expect(screen.getByTestId("pending-apply-summary")).toHaveTextContent(
    "2 pending changes",
  );
  expect(screen.getByTestId("pending-apply-batch-actions")).toBeInTheDocument();
  expect(screen.getByText("Keep all")).toBeInTheDocument();
  expect(screen.getByText("Undo all")).toBeInTheDocument();
  expect(
    screen.getByTestId("pending-apply-file-actions-0"),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId("pending-apply-file-actions-1"),
  ).toBeInTheDocument();
});

test("should be able to toggle modes", async () => {
  await renderWithProviders(<Chat />);
  await getElementByText("Agent");

  // Simulate cmd+. keyboard shortcut to toggle modes
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  // Check that it switched to Chat mode
  await getElementByText("Chat");

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  // Check that it switched to Plan mode
  await getElementByText("Plan");

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ".",
        metaKey: true, // cmd key on Mac
      }),
    );
  });

  await getElementByText("Agent");
});

test("should send a message and receive a response", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  // First add and select the mock LLM
  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const CONTENT = "Expected response";
  const INPUT = "User input";

  await sendInputWithMockedResponse(ideMessenger, INPUT, [
    { role: "assistant", content: CONTENT },
  ]);

  await getElementByText(CONTENT);
});

test("should render a compact chat header and switcher when session tabs are enabled", async () => {
  const initialState = getEmptyRootState();
  initialState.config.config.ui = {
    ...initialState.config.config.ui,
    showSessionTabs: true,
  };
  initialState.session.id = "session-current";
  initialState.session.title = "Alpha Chat";
  initialState.tabs.tabs = [
    {
      id: "tab-1",
      title: "Alpha Chat",
      isActive: true,
      sessionId: "session-current",
    },
    {
      id: "tab-2",
      title: "Draft Review",
      isActive: false,
    },
  ];

  const store = createMockStore(initialState);
  const { user } = await renderWithProviders(<Chat />, { store });

  await act(async () => {
    store.dispatch(
      updateConfig({
        ...store.getState().config.config,
        ui: {
          ...store.getState().config.config.ui,
          showSessionTabs: true,
        },
      }),
    );
  });

  expect(screen.getByText("Alpha Chat")).toBeInTheDocument();
  expect(screen.getByText("2 open chats")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Open chat switcher"));
  expect(screen.getByLabelText("Switch to Alpha Chat")).toBeInTheDocument();
  expect(screen.getByLabelText("Switch to Draft Review")).toBeInTheDocument();

  await user.type(screen.getByTestId("chat-switcher-search"), "Draft");

  expect(
    screen.queryByLabelText("Switch to Alpha Chat"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Switch to Draft Review")).toBeInTheDocument();
  await user.click(screen.getByLabelText("Switch to Draft Review"));

  expect(screen.getByText("Draft Review")).toBeInTheDocument();
});

test("should render a remote badge in the compact chat header", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-remote";
  initialState.session.title = "Remote Review";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-remote",
      title: "Remote Review",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace",
      isRemote: true,
      remoteId: "remote-123",
    },
  ];
  initialState.tabs.tabs = [
    {
      id: "tab-1",
      title: "Remote Review",
      isActive: true,
      sessionId: "session-remote",
    },
  ];

  await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  expect(screen.getByTestId("chat-header-status-remote")).toHaveTextContent(
    "Remote",
  );
});

test("should render live and background status badges in the compact chat header", async () => {
  const backgroundState = getEmptyRootState();
  backgroundState.session.id = "session-background";
  backgroundState.session.title = "Background Task";
  backgroundState.session.mode = "background";
  backgroundState.tabs.tabs = [
    {
      id: "tab-background",
      title: "Background Task",
      isActive: true,
      sessionId: "session-background",
    },
  ];

  const { unmount } = await renderWithProviders(<TabBar />, {
    store: createMockStore(backgroundState),
  });

  expect(screen.getByTestId("chat-header-status-background")).toHaveTextContent(
    "Background",
  );

  unmount();

  const liveAgentState = getEmptyRootState();
  liveAgentState.session.id = "session-agent";
  liveAgentState.session.title = "Live Agent";
  liveAgentState.session.mode = "agent";
  liveAgentState.session.activeAgentSessionId = "agent-session-456";
  liveAgentState.tabs.tabs = [
    {
      id: "tab-agent",
      title: "Live Agent",
      isActive: true,
      sessionId: "session-agent",
    },
  ];

  await renderWithProviders(<TabBar />, {
    store: createMockStore(liveAgentState),
  });

  expect(screen.getByTestId("chat-header-status-live-agent")).toHaveTextContent(
    "Live agent",
  );
});

test("should enter the live agent view when a remote agent session is loaded", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  ideMessenger.responses["agent/status" as any] = {
    status: "running",
    totalTurns: 2,
    messages: [],
  };

  await act(async () => {
    ideMessenger.mockMessageToWebview("loadAgentSession", {
      agentSessionId: "agent-session-123",
      session: {
        sessionId: "agent-session-123",
        title: "Remote Agent",
        history: [],
        mode: "agent",
      } as any,
    });
  });

  await getElementByText("Running");
  await getElementByText("Turn 2 / 50");
  expect(store.getState().session.activeAgentSessionId).toBe(
    "agent-session-123",
  );
});
