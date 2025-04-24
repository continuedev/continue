import { IDE, PromptLog } from "core";
import {
  FromWebviewProtocol,
  ToCoreProtocol,
  ToWebviewProtocol,
} from "core/protocol";
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

  constructor() {
    this.ide = new MessageIde(
      (messageType, data) => {
        throw new Error("Not implemented");
      },
      (messageType, callback) => {},
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
