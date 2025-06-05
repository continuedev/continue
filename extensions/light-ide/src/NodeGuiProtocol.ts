// Fix me - trying to implement a protocol for NodeGui similar to what VScode does for webviews
import { v4 as uuidv4 } from "uuid";
import { IMessenger, Message } from "core/protocol/messenger";
import { FromWebviewProtocol, ToWebviewProtocol } from "core/protocol";

export type Handler<T, U> = (message: Message<T>) => Promise<U> | U;

export class NodeGuiProtocol implements IMessenger<FromWebviewProtocol, ToWebviewProtocol> {
  private listeners = new Map<string, Handler<any, any>[]>();

  // Express will call this for each incoming protocol message
  async handleMessage(messageType: string, data: any, messageId: string) {
    const handlers = this.listeners.get(messageType) || [];
    let response: any = undefined;
    for (const handler of handlers) {
      response = await handler({ messageType, data, messageId });
    }
    return response;
  }

  send<T extends keyof ToWebviewProtocol>(messageType: T, data: any, messageId?: string): string {
    // In HTTP, sending is not needed; can use WS for pushing
    // For HTTP, only respond as result
    return messageId ?? uuidv4();
  }

  on<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: Handler<FromWebviewProtocol[T][0], FromWebviewProtocol[T][1]>
  ): void {
    if (!this.listeners.has(messageType as string)) {
      this.listeners.set(messageType as string, []);
    }
    this.listeners.get(messageType as string)!.push(handler);
  }

  request<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][0]
  ): Promise<ToWebviewProtocol[T][1]> {
    // Not used for Node backend; frontend can call /message
    throw new Error("Not implemented: request (backend)");
  }

  invoke<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string
  ): FromWebviewProtocol[T][1] {
    // Used by the core
    throw new Error("Not implemented: invoke (backend)");
  }

  onError(handler: (message: Message, error: Error) => void): void {
    // Error handler registration
  }
}
