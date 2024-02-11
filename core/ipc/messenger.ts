import { v4 as uuidv4 } from "uuid";
import {
  ChatMessage,
  CompletionOptions,
  ContextItem,
  ContextSubmenuItem,
  PersistedSessionInfo,
  RangeInFile,
  SerializedContinueConfig,
} from "..";

export abstract class Messenger {
  abstract send(messageType: string, message: any, messageId?: string): string;
  abstract on(messageType: string, handler: (message: any) => any): void;
}

export interface Message<T = any> {
  messageType: string;
  messageId: string;
  data: T;
}

type Protocol = {
  abort: [undefined, void];
  "history/list": [undefined, PersistedSessionInfo[]];
  "history/delete": [{ id: string }, void];
  "history/load": [{ id: string }, PersistedSessionInfo];
  "history/save": [PersistedSessionInfo, void];
  "devdata/log": [{ tableName: string; data: any }, void];
  "config/addOpenAiKey": [string, void];
  "config/addModel": [
    { model: SerializedContinueConfig["models"][number] },
    void,
  ];
  "config/deleteModel": [{ title: string }, void];
  "context/getContextItems": [
    {
      name: string;
      query: string;
      fullInput: string;
      selectedCode: RangeInFile[];
    },
    ContextItem[],
  ];
  "context/loadSubmenuItems": [{ title: string }, ContextSubmenuItem[]];
  "context/addDocs": [{ title: string; url: string }, void];
  "autocomplete/complete": [
    { filepath: string; line: number; column: number },
    string[],
  ];
  "command/run": [
    {
      input: string;
      history: ChatMessage[];
      modelTitle: string;
      slashCommandName: string;
      contextItems: ContextItem[];
      params: any;
      historyIndex: number;
    },
    AsyncGenerator<string>,
  ];
  "llm/complete": [
    {
      prompt: string;
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
  "llm/streamComplete": [
    {
      prompt: string;
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
  "llm/streamChat": [
    {
      messages: ChatMessage[];
      completionOptions: CompletionOptions;
      title: string;
    },
    AsyncGenerator<string>,
  ];
};
type ProtocolKeys = keyof Protocol;

type ProtocolCallbacks = {
  [K in ProtocolKeys]: (msg: Protocol[K][0]) => Protocol[K][1];
};

export class IpcMessenger extends Messenger {
  listeners = new Map<string, ((message: Message) => any)[]>();

  constructor() {
    super();

    console.log = console.error;

    process.stdin.on("data", (data) => {
      const d = data.toString();
      try {
        const msg: Message = JSON.parse(d);
        if (
          msg.data !== undefined ||
          msg.messageType !== undefined ||
          msg.messageId !== undefined
        ) {
          throw new Error("Invalid message sent: " + JSON.stringify(msg));
        }

        this.listeners.get(msg.messageType)?.forEach(async (handler) => {
          const response = await handler(msg);
          this.send(msg.messageType, response, msg.messageId);
        });
      } catch (e) {
        console.error("Invalid JSON:", d);
        return;
      }
    });
  }

  send(messageType: string, message: any, messageId?: string): string {
    messageId = messageId ?? uuidv4();
    const data: Message = {
      messageType,
      data: message,
      messageId,
    };
    // process.send?.(data);
    process.stdout?.write(JSON.stringify(data));
    return messageId;
  }

  on<T extends keyof Protocol>(
    messageType: T,
    handler: (message: Message<Protocol[T][0]>) => Protocol[T][1]
  ): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)?.push(handler);
  }
}
