import { act, screen, waitFor, within } from "@testing-library/react";
import { BuiltInToolNames } from "core/tools/builtIn";
import { BackgroundModeView } from "../../../components/BackgroundMode/BackgroundModeView";
import { EditOutcomeToolbar } from "../../../components/mainInput/Lump/LumpToolbar/EditOutcomeToolbar";
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

test("should render the team coordination panel when the session has an active team", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-current";

  const mockIdeMessenger = new MockIdeMessenger();
  mockIdeMessenger.responseHandlers["tools/call"] = vi.fn(async (data: any) => {
    const functionName = data.toolCall.function.name;

    if (functionName === BuiltInToolNames.TeamStatus) {
      return {
        contextItems: [
          {
            name: "Team Status",
            description: "Team Coordination",
            content:
              "Team Coordination\nLead: team-lead\nMembers:\n- team-lead: idle\n- investigator: running, unread=1",
          },
        ],
        errorMessage: undefined,
      };
    }

    return {
      contextItems: [
        {
          name: "Team Mailbox",
          description: "Mailbox team-lead",
          content:
            "Mailbox for team-lead in Coordination (1 message(s)):\n- [message] investigator @ 2026-05-14T00:00:00.000Z\nMapped the owning files.",
        },
      ],
      errorMessage: undefined,
    };
  });

  await renderWithProviders(<Chat />, {
    store: createMockStore(initialState, mockIdeMessenger),
    mockIdeMessenger,
  });

  await waitFor(() => {
    expect(screen.getByTestId("team-coordination-panel")).toBeInTheDocument();
  });
  expect(screen.getByText("Team coordination")).toBeInTheDocument();
  expect(screen.getByText("Mailbox")).toBeInTheDocument();
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

test("should render edit outcome review copy and in-flight keep feedback", async () => {
  const initialState = getEmptyRootState();
  initialState.editModeState.applyState = {
    streamId: "edit-apply-1",
    status: "done",
    filepath: "/workspace/src/refactor.ts",
    numDiffs: 2,
  };
  initialState.editModeState.codeToEdit = [
    {
      filepath: "/workspace/src/refactor.ts",
      contents: "const value = 1;",
    },
  ];

  const { user } = await renderWithProviders(<EditOutcomeToolbar />, {
    store: createMockStore(initialState),
  });

  expect(screen.getByTestId("edit-outcome-toolbar")).toHaveTextContent(
    "Review edit outcome",
  );
  expect(screen.getByTestId("edit-outcome-diff-count")).toHaveTextContent(
    "refactor.ts",
  );
  expect(screen.getByTestId("edit-outcome-target")).toHaveTextContent(
    "refactor.ts",
  );

  await user.click(screen.getByText("Keep"));

  expect(screen.getByText("Keeping...")).toBeInTheDocument();
});

test("should render background inbox state inside the main chat shell", async () => {
  const initialState = getEmptyRootState();
  const store = createMockStore(initialState);
  const mockIdeMessenger = new MockIdeMessenger();

  mockIdeMessenger.responses["listBackgroundAgents"] = {
    agents: [
      {
        id: "agent-1",
        name: "Refactor auth flow",
        status: "running",
        repoUrl: "https://github.com/example/yuto-code",
        pullRequestUrl: "https://github.com/example/yuto-code/pull/42",
        pullRequestStatus: "open",
        createdAt: "2026-05-09T00:00:00.000Z",
        metadata: {
          github_repo: "https://github.com/example/yuto-code",
          source: "chat",
          createdBySlug: "fran",
        },
      },
    ],
    totalCount: 1,
  };
  mockIdeMessenger.responseHandlers.getRepoName = async () =>
    "https://github.com/example/yuto-code";

  await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-inbox-panel"),
  ).toBeInTheDocument();
  expect(screen.getByText("Background inbox")).toBeInTheDocument();
  expect(screen.getByText("Refactor auth flow")).toBeInTheDocument();
  expect(screen.getByText("Current workspace")).toBeInTheDocument();
  expect(screen.getByTestId("background-inbox-open-local-0")).toHaveTextContent(
    "Open locally",
  );
  expect(screen.getByTestId("background-inbox-provenance-0")).toHaveTextContent(
    "PR open",
  );
  expect(screen.getByTestId("background-inbox-provenance-0")).toHaveTextContent(
    "Source chat",
  );
  expect(screen.getByTestId("background-inbox-provenance-0")).toHaveTextContent(
    "By fran",
  );
  expect(screen.getByTestId("background-inbox-agent-0")).toBeInTheDocument();
  expect(screen.getByTestId("background-inbox-refresh")).toHaveTextContent(
    "Refresh",
  );
  expect(screen.getByTestId("background-inbox-open-queue")).toHaveTextContent(
    "Open inbox",
  );
});

test("should open the full background queue from the compact inbox", async () => {
  const store = createMockStore(getEmptyRootState());
  const mockIdeMessenger = new MockIdeMessenger();
  const postSpy = vi.spyOn(mockIdeMessenger, "post");

  mockIdeMessenger.responses["listBackgroundAgents"] = {
    agents: [
      {
        id: "agent-queue-1",
        name: "Queue task",
        status: "running",
        repoUrl: "https://github.com/example/yuto-code",
        createdAt: "2026-05-09T00:00:00.000Z",
        metadata: {
          github_repo: "https://github.com/example/yuto-code",
        },
      },
    ],
    totalCount: 1,
  };
  mockIdeMessenger.responseHandlers.getRepoName = async () =>
    "https://github.com/example/yuto-code";

  const { user } = await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  await screen.findByTestId("background-inbox-panel");
  await user.click(screen.getByTestId("background-inbox-open-queue"));

  expect(postSpy).toHaveBeenCalledWith("controlPlane/openUrl", {
    path: "agents",
  });
});

test("should refresh the compact background inbox on demand", async () => {
  const store = createMockStore(getEmptyRootState());
  const mockIdeMessenger = new MockIdeMessenger();
  let listBackgroundAgentsCalls = 0;

  mockIdeMessenger.responseHandlers.listBackgroundAgents = async () => {
    listBackgroundAgentsCalls += 1;
    return {
      agents: [
        {
          id: "agent-refresh-1",
          name: "Refresh auth flow",
          status: "running",
          repoUrl: "https://github.com/example/yuto-code",
          createdAt: "2026-05-09T00:00:00.000Z",
          metadata: {
            github_repo: "https://github.com/example/yuto-code",
          },
        },
      ],
      totalCount: 1,
    };
  };
  mockIdeMessenger.responseHandlers.getRepoName = async () =>
    "https://github.com/example/yuto-code";

  const { user } = await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  await screen.findByTestId("background-inbox-panel");
  expect(listBackgroundAgentsCalls).toBe(1);

  await user.click(screen.getByTestId("background-inbox-refresh"));

  await waitFor(() => {
    expect(listBackgroundAgentsCalls).toBe(2);
  });
});

test("should explain takeover when a background task belongs to another repo", async () => {
  const store = createMockStore(getEmptyRootState());
  const mockIdeMessenger = new MockIdeMessenger();

  mockIdeMessenger.responses["listBackgroundAgents"] = {
    agents: [
      {
        id: "agent-2",
        name: "Review backend migration",
        status: "pending",
        repoUrl: "https://github.com/example/backend",
        createdAt: "2026-05-09T00:00:00.000Z",
        metadata: {
          github_repo: "https://github.com/example/backend",
        },
      },
    ],
    totalCount: 1,
  };
  mockIdeMessenger.responseHandlers.getRepoName = async () =>
    "https://github.com/example/yuto-code";

  await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-inbox-panel"),
  ).toBeInTheDocument();
  expect(screen.getByText("Other repo")).toBeInTheDocument();
  expect(screen.getByTestId("background-inbox-agent-0")).toHaveTextContent(
    "Open backend locally to take over.",
  );
  expect(screen.getByTestId("background-inbox-open-local-0")).toBeDisabled();
});

test("should show compact GitHub setup guidance for background tasks", async () => {
  const store = createMockStore(getEmptyRootState());
  const mockIdeMessenger = new MockIdeMessenger();

  mockIdeMessenger.responseHandlers.listBackgroundAgents = async () => {
    throw new Error("GitHub token missing");
  };

  await renderWithProviders(<Chat />, {
    store,
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-inbox-panel"),
  ).toBeInTheDocument();
  expect(screen.getByText("Connect GitHub")).toBeInTheDocument();
  expect(
    screen.getByTestId("background-inbox-connect-github"),
  ).toBeInTheDocument();
});

test("should render full background mode with explicit handoff actions and provenance", async () => {
  const mockIdeMessenger = new MockIdeMessenger();

  mockIdeMessenger.responses["listBackgroundAgents"] = {
    agents: [
      {
        id: "agent-full-1",
        name: "Ship release branch",
        status: "running",
        repoUrl: "https://github.com/example/yuto-code",
        pullRequestUrl: "https://github.com/example/yuto-code/pull/84",
        pullRequestStatus: "open",
        createdAt: "2026-05-10T00:00:00.000Z",
        metadata: {
          github_repo: "https://github.com/example/yuto-code",
          source: "background",
          createdBySlug: "fran",
        },
      },
    ],
    totalCount: 1,
  };
  mockIdeMessenger.responseHandlers.getRepoName = async () =>
    "https://github.com/example/yuto-code";

  await renderWithProviders(<BackgroundModeView />, {
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-full-summary"),
  ).toBeInTheDocument();
  expect(screen.getByTestId("background-full-summary")).toHaveTextContent(
    "Background inbox",
  );
  expect(
    screen.getByTestId("background-full-summary-workspace-count"),
  ).toHaveTextContent("1 ready here");
  expect(
    await screen.findByTestId("background-full-agent-0"),
  ).toBeInTheDocument();
  expect(screen.getByTestId("background-full-agent-0")).toHaveTextContent(
    "Ship release branch",
  );
  expect(screen.getByTestId("background-full-agent-0")).toHaveTextContent(
    "Current workspace",
  );
  expect(screen.getByTestId("background-full-view-task-0")).toHaveTextContent(
    "View task",
  );
  expect(screen.getByTestId("background-full-open-local-0")).toHaveTextContent(
    "Open locally",
  );
  expect(screen.getByTestId("background-full-provenance-0")).toHaveTextContent(
    "PR open",
  );
  expect(screen.getByTestId("background-full-provenance-0")).toHaveTextContent(
    "Source background",
  );
  expect(screen.getByTestId("background-full-provenance-0")).toHaveTextContent(
    "By fran",
  );
  expect(screen.getByTestId("background-full-refresh")).toHaveTextContent(
    "Refresh",
  );
});

test("should show full background inbox GitHub setup guidance", async () => {
  const mockIdeMessenger = new MockIdeMessenger();

  mockIdeMessenger.responseHandlers.listBackgroundAgents = async () => {
    throw new Error("GitHub token missing");
  };

  await renderWithProviders(<BackgroundModeView />, {
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-full-setup-panel"),
  ).toBeInTheDocument();
  expect(screen.getByText("Background inbox")).toBeInTheDocument();
  expect(
    screen.getByText(/Connect GitHub to track cloud background tasks/),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId("background-full-connect-github"),
  ).toHaveTextContent("Connect GitHub");
});

test("should open the cloud inbox from the full empty background panel", async () => {
  const mockIdeMessenger = new MockIdeMessenger();
  const postSpy = vi.spyOn(mockIdeMessenger, "post");

  mockIdeMessenger.responses["listBackgroundAgents"] = {
    agents: [],
    totalCount: 0,
  };

  const { user } = await renderWithProviders(<BackgroundModeView />, {
    mockIdeMessenger,
  });

  expect(
    await screen.findByTestId("background-full-empty-panel"),
  ).toBeInTheDocument();

  await user.click(screen.getByTestId("background-full-open-queue-empty"));

  expect(postSpy).toHaveBeenCalledWith("controlPlane/openUrl", {
    path: "agents",
  });
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
  const { user } = await renderWithProviders(<Chat />, { store });

  expect(screen.getByTestId("pending-apply-summary")).toHaveTextContent(
    "2 files",
  );
  expect(screen.getByTestId("pending-apply-summary")).toHaveTextContent(
    "2 changes",
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

  await user.click(screen.getByText("Keep all"));

  expect(screen.getByText("Keeping all...")).toBeInTheDocument();
  expect(
    within(screen.getByTestId("pending-apply-batch-actions")).getByTestId(
      "edit-accept-button",
    ),
  ).toBeDisabled();
  expect(
    within(screen.getByTestId("pending-apply-batch-actions")).getByTestId(
      "edit-reject-button",
    ),
  ).toBeDisabled();
});

test("should collapse dense pending edit batches until expanded", async () => {
  const initialState = getEmptyRootState();
  initialState.session.codeBlockApplyStates.states = [
    {
      streamId: "apply-1",
      status: "done",
      filepath: "/workspace/src/auth/first.ts",
      toolCallId: "tool-call-1",
    },
    {
      streamId: "apply-2",
      status: "done",
      filepath: "/workspace/src/auth/second.ts",
      toolCallId: "tool-call-2",
    },
    {
      streamId: "apply-3",
      status: "done",
      filepath: "/workspace/src/data/third.ts",
      toolCallId: "tool-call-3",
    },
    {
      streamId: "apply-4",
      status: "done",
      filepath: "/workspace/src/data/fourth.ts",
      toolCallId: "tool-call-4",
    },
    {
      streamId: "apply-5",
      status: "done",
      filepath: "/workspace/src/ui/fifth.ts",
      toolCallId: "tool-call-5",
    },
  ];

  const { user } = await renderWithProviders(<Chat />, {
    store: createMockStore(initialState),
  });

  expect(screen.getByTestId("pending-apply-visible-count")).toHaveTextContent(
    "Showing 3 of 5 files",
  );
  expect(screen.getByTestId("pending-apply-overflow-toggle")).toHaveTextContent(
    "Show 2 more files",
  );
  expect(screen.getByTestId("pending-apply-file-path-0")).toHaveTextContent(
    "src/auth",
  );
  expect(screen.getByTestId("pending-apply-file-row-0")).toHaveTextContent(
    "first.ts",
  );
  expect(screen.getByTestId("pending-apply-file-row-2")).toHaveTextContent(
    "third.ts",
  );
  expect(screen.getByTestId("pending-apply-hidden-preview")).toHaveTextContent(
    "Hidden until expanded",
  );
  expect(screen.getByTestId("pending-apply-hidden-group-0")).toHaveTextContent(
    "src/data",
  );
  expect(screen.getByTestId("pending-apply-hidden-group-1")).toHaveTextContent(
    "src/ui",
  );
  expect(screen.queryByText("fourth.ts")).not.toBeInTheDocument();
  expect(screen.queryByText("fifth.ts")).not.toBeInTheDocument();

  await user.click(screen.getByTestId("pending-apply-overflow-toggle"));

  expect(screen.getByTestId("pending-apply-visible-count")).toHaveTextContent(
    "Showing all 5 files",
  );
  expect(screen.getByTestId("pending-apply-overflow-toggle")).toHaveTextContent(
    "Show fewer files",
  );
  expect(
    screen.queryByTestId("pending-apply-hidden-preview"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("fourth.ts")).toBeInTheDocument();
  expect(screen.getByText("fifth.ts")).toBeInTheDocument();
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

test("should allow sending in agent mode when streaming flag is set", async () => {
  const initialState = getEmptyRootState();
  initialState.session.mode = "agent";
  initialState.session.isStreaming = true;

  const store = createMockStore(initialState);
  const { ideMessenger } = await renderWithProviders(<Chat />, {
    store,
  });

  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const requestSpy = vi.spyOn(ideMessenger, "request");

  const sendButton = await getElementByTestId("submit-input-button");
  expect(sendButton).not.toBeDisabled();

  const INPUT = "Please continue in agent mode";

  await sendInputWithMockedResponse(ideMessenger, INPUT, [
    { role: "assistant", content: "This is a test" },
  ]);

  await waitFor(() => {
    expect(
      requestSpy.mock.calls.some(
        ([messageType]) => messageType === "agent/run",
      ),
    ).toBe(true);
  });
});

test("should fall back to chat streaming when agent/run returns an error status", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const originalRequest = ideMessenger.request.bind(ideMessenger);
  vi.spyOn(ideMessenger, "request").mockImplementation(
    async (messageType, data) => {
      if (messageType === "agent/run") {
        return {
          status: "error",
          error: "agent unavailable",
          done: true,
        } as any;
      }

      return originalRequest(messageType as any, data as any);
    },
  );

  const CONTENT = "Fallback response";
  const INPUT = "Please help with this";

  await sendInputWithMockedResponse(ideMessenger, INPUT, [
    { role: "assistant", content: CONTENT },
  ]);

  await getElementByText(CONTENT);
});

test("should fall back to chat streaming when agent/run success payload is missing sessionId", async () => {
  const { ideMessenger, store } = await renderWithProviders(<Chat />);

  await act(async () => {
    addAndSelectMockLlm(store, ideMessenger);
  });

  const originalRequest = ideMessenger.request.bind(ideMessenger);
  vi.spyOn(ideMessenger, "request").mockImplementation(
    async (messageType, data) => {
      if (messageType === "agent/run") {
        return {
          status: "success",
          content: {},
          done: true,
        } as any;
      }

      return originalRequest(messageType as any, data as any);
    },
  );

  const CONTENT = "Fallback after missing session id";
  const INPUT = "Please run in agent mode";

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
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-current",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 12,
    },
    {
      sessionId: "session-review",
      title: "Draft Review",
      dateCreated: "2026-05-09T01:00:00.000Z",
      workspaceDirectory: "/workspace/backend",
      messageCount: 3,
    },
  ];
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
      sessionId: "session-review",
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
  expect(screen.getByText("12 messages")).toBeInTheDocument();
  expect(screen.getByText("3 messages")).toBeInTheDocument();
  expect(screen.getByText("2 chats")).toBeInTheDocument();

  await user.type(screen.getByTestId("chat-switcher-search"), "backend");

  expect(
    screen.queryByLabelText("Switch to Alpha Chat"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Switch to Draft Review")).toBeInTheDocument();
  expect(screen.getByTestId("chat-switcher-result-count")).toHaveTextContent(
    "Showing 1 of 2 chats",
  );
  await user.click(screen.getByLabelText("Switch to Draft Review"));

  expect(screen.getByText("Draft Review")).toBeInTheDocument();
});

test("should collapse and rank dense switcher results", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-active";
  initialState.session.title = "Alpha Chat";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-active",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 2,
    },
    {
      sessionId: "session-2",
      title: "Sprint Planning",
      dateCreated: "2026-05-09T07:00:00.000Z",
      workspaceDirectory: "/workspace/plans",
      messageCount: 11,
    },
    {
      sessionId: "session-3",
      title: "Bug Bash",
      dateCreated: "2026-05-09T06:00:00.000Z",
      workspaceDirectory: "/workspace/bugs",
      messageCount: 9,
    },
    {
      sessionId: "session-4",
      title: "Backend Review",
      dateCreated: "2026-05-09T05:00:00.000Z",
      workspaceDirectory: "/workspace/reviews",
      messageCount: 7,
    },
    {
      sessionId: "session-5",
      title: "Daily Standup",
      dateCreated: "2026-05-09T04:00:00.000Z",
      workspaceDirectory: "/workspace/backend",
      messageCount: 5,
    },
    {
      sessionId: "session-6",
      title: "Design Notes",
      dateCreated: "2026-05-09T03:00:00.000Z",
      workspaceDirectory: "/workspace/design",
      messageCount: 4,
    },
    {
      sessionId: "session-7",
      title: "Archive Chat",
      dateCreated: "2026-05-09T02:00:00.000Z",
      workspaceDirectory: "/workspace/archive",
      messageCount: 3,
    },
    {
      sessionId: "session-8",
      title: "Scratchpad",
      dateCreated: "2026-05-09T01:00:00.000Z",
      workspaceDirectory: "/workspace/scratch",
      messageCount: 1,
    },
  ];
  initialState.tabs.tabs = [
    {
      id: "tab-2",
      title: "Sprint Planning",
      isActive: false,
      sessionId: "session-2",
    },
    {
      id: "tab-3",
      title: "Bug Bash",
      isActive: false,
      sessionId: "session-3",
    },
    {
      id: "tab-4",
      title: "Backend Review",
      isActive: false,
      sessionId: "session-4",
    },
    {
      id: "tab-5",
      title: "Daily Standup",
      isActive: false,
      sessionId: "session-5",
    },
    {
      id: "tab-6",
      title: "Design Notes",
      isActive: false,
      sessionId: "session-6",
    },
    {
      id: "tab-7",
      title: "Archive Chat",
      isActive: false,
      sessionId: "session-7",
    },
    {
      id: "tab-8",
      title: "Scratchpad",
      isActive: false,
      sessionId: "session-8",
    },
    {
      id: "tab-1",
      title: "Alpha Chat",
      isActive: true,
      sessionId: "session-active",
    },
  ];

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  await user.click(screen.getByLabelText("Open chat switcher"));

  const switcherButtons = screen.getAllByRole("button", {
    name: /Switch to /,
  });
  expect(switcherButtons[0]).toHaveAttribute(
    "aria-label",
    "Switch to Alpha Chat",
  );
  expect(screen.getByTestId("chat-switcher-result-count")).toHaveTextContent(
    "Showing 6 of 8 chats",
  );
  expect(screen.getByTestId("chat-switcher-overflow-toggle")).toHaveTextContent(
    "Show 2 more chats",
  );
  expect(
    screen.queryByLabelText("Switch to Archive Chat"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Switch to Scratchpad"),
  ).not.toBeInTheDocument();

  await user.click(screen.getByTestId("chat-switcher-overflow-toggle"));

  expect(screen.getByLabelText("Switch to Archive Chat")).toBeInTheDocument();
  expect(screen.getByLabelText("Switch to Scratchpad")).toBeInTheDocument();
  expect(screen.getByTestId("chat-switcher-overflow-toggle")).toHaveTextContent(
    "Show fewer chats",
  );

  await user.type(screen.getByTestId("chat-switcher-search"), "backend");

  const rankedFilteredButtons = screen.getAllByRole("button", {
    name: /Switch to /,
  });
  expect(rankedFilteredButtons[0]).toHaveAttribute(
    "aria-label",
    "Switch to Backend Review",
  );
  expect(rankedFilteredButtons[1]).toHaveAttribute(
    "aria-label",
    "Switch to Daily Standup",
  );
  expect(screen.getByTestId("chat-switcher-result-count")).toHaveTextContent(
    "Showing 2 of 8 chats",
  );
});

test("should support keyboard navigation in the compact chat switcher", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-current";
  initialState.session.title = "Alpha Chat";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-current",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 12,
    },
    {
      sessionId: "session-review",
      title: "Draft Review",
      dateCreated: "2026-05-09T01:00:00.000Z",
      workspaceDirectory: "/workspace/backend",
      messageCount: 3,
    },
  ];
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
      sessionId: "session-review",
    },
  ];

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  await user.click(screen.getByLabelText("Open chat switcher"));
  expect(screen.getByTestId("chat-switcher-search")).toHaveFocus();

  await user.keyboard("{ArrowDown}");
  expect(screen.getByLabelText("Switch to Alpha Chat")).toHaveFocus();

  await user.keyboard("{ArrowDown}");
  expect(screen.getByLabelText("Switch to Draft Review")).toHaveFocus();

  await user.keyboard("{Enter}");
  expect(screen.queryByTestId("chat-switcher-search")).not.toBeInTheDocument();
  expect(screen.getByText("Draft Review")).toBeInTheDocument();

  await user.click(screen.getByLabelText("Open chat switcher"));
  expect(screen.getByTestId("chat-switcher-search")).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(screen.queryByTestId("chat-switcher-search")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Open chat switcher")).toHaveFocus();
});

test("should open the compact chat switcher from the header with ArrowDown", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-current";
  initialState.session.title = "Alpha Chat";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-current",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 12,
    },
    {
      sessionId: "session-review",
      title: "Draft Review",
      dateCreated: "2026-05-09T01:00:00.000Z",
      workspaceDirectory: "/workspace/backend",
      messageCount: 3,
    },
  ];
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
      sessionId: "session-review",
    },
  ];

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  screen.getByLabelText("Open chat switcher").focus();
  await user.keyboard("{ArrowDown}");

  expect(screen.getByTestId("chat-switcher-search")).toBeInTheDocument();
  expect(screen.getByTestId("chat-switcher-search")).toHaveFocus();
});

test("should switch to the top visible chat when pressing Enter in switcher search", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-current";
  initialState.session.title = "Alpha Chat";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-current",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 12,
    },
    {
      sessionId: "session-review",
      title: "Draft Review",
      dateCreated: "2026-05-09T01:00:00.000Z",
      workspaceDirectory: "/workspace/backend",
      messageCount: 3,
    },
  ];
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
      sessionId: "session-review",
    },
  ];

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  await user.click(screen.getByLabelText("Open chat switcher"));
  await user.type(screen.getByTestId("chat-switcher-search"), "backend");
  await user.keyboard("{Enter}");

  expect(screen.queryByTestId("chat-switcher-search")).not.toBeInTheDocument();
  expect(screen.getByText("Draft Review")).toBeInTheDocument();
});

test("should keep the switcher open when Enter is pressed with no matching chats", async () => {
  const initialState = getEmptyRootState();
  initialState.session.id = "session-current";
  initialState.session.title = "Alpha Chat";
  initialState.session.allSessionMetadata = [
    {
      sessionId: "session-current",
      title: "Alpha Chat",
      dateCreated: "2026-05-09T00:00:00.000Z",
      workspaceDirectory: "/workspace/alpha",
      messageCount: 12,
    },
  ];
  initialState.tabs.tabs = [
    {
      id: "tab-1",
      title: "Alpha Chat",
      isActive: true,
      sessionId: "session-current",
    },
  ];

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  await user.click(screen.getByLabelText("Open chat switcher"));
  await user.type(screen.getByTestId("chat-switcher-search"), "missing");
  await user.keyboard("{Enter}");

  expect(screen.getByTestId("chat-switcher-search")).toBeInTheDocument();
  expect(screen.getByTestId("chat-switcher-empty-state")).toHaveTextContent(
    "No matching chats",
  );
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

  const { user } = await renderWithProviders(<TabBar />, {
    store: createMockStore(initialState),
  });

  expect(screen.getByTestId("chat-header-status-remote")).toHaveTextContent(
    "Remote",
  );
  expect(screen.getByTestId("chat-header-provenance")).toHaveTextContent(
    "Cloud session | remote-123",
  );

  await user.click(screen.getByLabelText("Open chat switcher"));
  expect(screen.getByLabelText("Switch to Remote Review")).toHaveTextContent(
    "Cloud session | remote-123",
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
