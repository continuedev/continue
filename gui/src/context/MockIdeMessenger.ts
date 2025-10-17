import { ChatMessage, IDE, PromptLog } from "core";
import { AuthType } from "core/control-plane/AuthTypes";
import {
  FromWebviewProtocol,
  ToCoreProtocol,
  ToWebviewProtocol,
} from "core/protocol";
import { Message } from "core/protocol/messenger";
import { MessageIde } from "core/protocol/messenger/messageIde";
import {
  GeneratorReturnType,
  GeneratorYieldType,
  WebviewSingleProtocolMessage,
} from "core/protocol/util";
import { IIdeMessenger } from "./IdeMessenger";

type MockResponses = Partial<{
  [K in keyof FromWebviewProtocol]: FromWebviewProtocol[K][1];
}>;

export type MockResponseHandler<T extends keyof FromWebviewProtocol> = (
  input: FromWebviewProtocol[T][0],
) => Promise<FromWebviewProtocol[T][1]>;

type MockResponseHandlers = Partial<{
  [K in keyof FromWebviewProtocol]: MockResponseHandler<K>;
}>;

const DEFAULT_MOCK_CORE_RESPONSES: MockResponses = {
  fileExists: true,
  getCurrentFile: {
    isUntitled: false,
    contents: "Current file contents",
    path: "file:///Users/user/workspace1/current_file.py",
  },
  "controlPlane/getCreditStatus": {
    optedInToFreeTrial: false,
    creditBalance: 0,
    hasCredits: false,
    hasPurchasedCredits: false,
  },
  getWorkspaceDirs: [
    "file:///Users/user/workspace1",
    "file:///Users/user/workspace2",
  ],
  "history/list": [],
  "docs/getIndexedPages": [],
  "history/save": undefined,
  getControlPlaneSessionInfo: {
    AUTH_TYPE: AuthType.WorkOsStaging,
    accessToken: "",
    account: {
      label: "",
      id: "",
    },
  },
  "config/getSerializedProfileInfo": {
    organizations: [
      {
        id: "personal",
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
        slug: "",
        selectedProfileId: "local",
        name: "Personal",
        iconUrl: "",
      },
    ],
    profileId: "local",
    result: {
      config: undefined,
      errors: [],
      configLoadInterrupted: false,
    },
    selectedOrgId: "personal",
  },
  "chatDescriber/describe": "Session summary",
  applyToFile: undefined,
  acceptDiff: undefined,
  readFile: "File contents",
  "tools/call": {
    contextItems: [
      {
        content: "Tool call executed successfully",
        name: "Tool Result",
        description: "Mock tool result",
      },
    ],
  },
  "context/getSymbolsForFiles": {},
  "tools/preprocessArgs": {
    preprocessedArgs: undefined,
  },
  "llm/compileChat": {
    compiledChatMessages: [],
    didPrune: false,
    contextPercentage: 0.5,
  },
  "context/getContextItems": [
    {
      id: {
        providerTitle: "mock",
        itemId: "mock",
      },
      content: "Mock current file content",
      name: "Mock File",
      description: "Mock file for testing",
      uri: {
        type: "file",
        value: "file:///Users/test/mock-file.ts",
      },
    },
  ],
  listBackgroundAgents: { agents: [], totalCount: 0 },
};

const DEFAULT_MOCK_CORE_RESPONSE_HANDLERS: MockResponseHandlers = {
  "tools/evaluatePolicy": async (data) => {
    return {
      policy: data.basePolicy,
      displayValue: undefined,
    };
  },
};

const DEFAULT_CHAT_RESPONSE: ChatMessage[] = [
  {
    role: "assistant",
    content: "This is a test",
  },
];
export class MockIdeMessenger implements IIdeMessenger {
  ide: IDE;

  constructor() {
    this.ide = new MessageIde(
      async (messageType, data) => {
        const response = await this.request.bind(this)(messageType, data);
        if (response.status === "error") {
          throw new Error(response.error);
        } else {
          return response.content;
        }
      },
      (messageType, callback) => {
        return;
      },
    );
  }

  /**
   * Simulates a message being sent from the IDE to the webview
   * @param messageType The type of message to send
   * @param data The data to send with the message
   */
  mockMessageToWebview<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][0],
  ): void {
    // Create a message object that matches what the useWebviewListener hook expects
    const messageData: Message<ToWebviewProtocol[T][0]> = {
      messageType,
      data,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(2)}`,
    };

    // Dispatch a custom message event that the window event listener will pick up
    window.dispatchEvent(
      new MessageEvent("message", {
        data: messageData,
        origin: window.location.origin,
      }),
    );
  }

  responses: MockResponses = { ...DEFAULT_MOCK_CORE_RESPONSES };
  responseHandlers: MockResponseHandlers = {
    ...DEFAULT_MOCK_CORE_RESPONSE_HANDLERS,
  };
  chatResponse: ChatMessage[] = DEFAULT_CHAT_RESPONSE;
  chatStreamDelay: number = 0;
  setChatResponseText(text: string): void {
    this.chatResponse = [
      {
        role: "assistant",
        content: text,
      },
    ];
  }

  async *llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    for (const response of this.chatResponse) {
      if (cancelToken.aborted) {
        console.log("MockIdeMessenger: Stream aborted");
        return undefined;
      }
      console.log(
        "MockIdeMessenger: Yielding chunk",
        JSON.stringify(response, null, 2),
      );
      yield [response];
      if (this.chatStreamDelay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.chatStreamDelay),
        );
      }
    }
    return undefined;
  }

  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt?: number,
  ): void {}

  async request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleProtocolMessage<T>> {
    if (this.responseHandlers[messageType]) {
      const content = await this.responseHandlers[messageType](data);
      return {
        status: "success",
        content,
        done: true,
      };
    }
    if (messageType in this.responses) {
      const content = this.responses[messageType];
      return {
        status: "success",
        content,
        done: true,
      };
    }
    console.error(messageType);
    throw new Error(
      "MockIdeMessenger: No response handler or response defined for " +
        messageType,
    );
  }

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ): void {}

  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  > {
    return undefined;
  }

  resetMocks(): void {
    this.responses = { ...DEFAULT_MOCK_CORE_RESPONSES };
    this.responseHandlers = { ...DEFAULT_MOCK_CORE_RESPONSE_HANDLERS };
    this.chatResponse = DEFAULT_CHAT_RESPONSE;
    this.chatStreamDelay = 0;
  }
}
