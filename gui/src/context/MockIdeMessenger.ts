import { IDE, PromptLog } from "core";
import {
  FromIdeProtocol,
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
import { ChatMessage } from "../redux/store";
import { IIdeMessenger } from "./IdeMessenger";

async function defaultMockHandleMessage<T extends keyof FromWebviewProtocol>(
  messageType: T,
  data: FromWebviewProtocol[T][0],
): Promise<FromWebviewProtocol[T][1]> {
  function returnFor<K extends keyof FromWebviewProtocol>(
    _: K,
    value: FromWebviewProtocol[K][1],
  ): FromWebviewProtocol[T][1] {
    return value as unknown as FromWebviewProtocol[T][1];
  }

  switch (messageType) {
    case "history/list":
      return returnFor("history/list", [
        {
          title: "Session 1",
          sessionId: "session-1",
          dateCreated: new Date().toString(),
          workspaceDirectory: "/tmp",
        },
      ]);
    case "getControlPlaneSessionInfo":
      return returnFor("getControlPlaneSessionInfo", {
        accessToken: "",
        account: {
          label: "",
          id: "",
        },
      });
    case "config/getSerializedProfileInfo":
      return returnFor("config/getSerializedProfileInfo", {
        organizations: [],
        profileId: "test-profile",
        result: {
          config: undefined,
          errors: [],
          configLoadInterrupted: false,
        },
        selectedOrgId: "local",
      });
    default:
      throw new Error(`Unknown message type ${messageType}`);
  }
}

export class MockIdeMessenger implements IIdeMessenger {
  ide: IDE;
  private messageHandlers: Map<
    keyof FromIdeProtocol,
    Array<(data: any) => void>
  > = new Map();

  constructor() {
    this.ide = new MessageIde(
      (messageType, data) => {
        throw new Error("Not implemented");
      },
      (messageType, callback) => {
        // Store the callback in our handlers map
        if (!this.messageHandlers.has(messageType)) {
          this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType)?.push(callback);
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

  async *llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    yield [
      {
        role: "assistant",
        content: "This is a test",
      },
    ];
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
    const content = await defaultMockHandleMessage(messageType, data);
    return {
      status: "success",
      content,
      done: true,
    };
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
}
