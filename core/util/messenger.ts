import { v4 as uuidv4 } from "uuid";
import type { IProtocol } from "../protocol";

export interface Message<T = any> {
  messageType: string;
  messageId: string;
  data: T;
}

export interface FromMessage<
  FromProtocol extends IProtocol,
  T extends keyof FromProtocol,
> {
  messageType: T;
  messageId: string;
  data: FromProtocol[T][1];
}

export interface IMessenger<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> {
  onError(handler: (error: Error) => void): void;
  send<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
    messageId?: string,
  ): string;

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (message: Message<ToProtocol[T][0]>) => ToProtocol[T][1],
  ): void;

  request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]>;

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
  ): ToProtocol[T][1];
}

export class InProcessMessenger<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> implements IMessenger<ToProtocol, FromProtocol>
{
  protected typeListeners = new Map<
    keyof ToProtocol,
    ((message: Message) => any)[]
  >();
  protected idListeners = new Map<string, (message: Message) => any>();
  protected _onErrorHandlers: ((error: Error) => void)[] = [];

  onError(handler: (error: Error) => void) {
    this._onErrorHandlers.push(handler);
  }

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
  ): ToProtocol[T][1] {
    const listeners = this.typeListeners.get(messageType);
    if (!listeners || !listeners.length) return;

    const msg: Message = {
      messageType: messageType as string,
      data,
      messageId: uuidv4(),
    };
    return listeners[0](msg);
  }

  // get reverseMessenger(): IMessenger<ToProtocol, FromProtocol> {
  //   return {
  //     onError: (handler: (error: Error) => void) => {},
  //     send: (messageType: string, message: any, messageId?: string) => {
  //       const messageId_ = messageId || uuidv4();
  //       this.handleMessage({
  //         messageType,
  //         messageId: messageId_,
  //         data: message,
  //       });
  //       return messageId_;
  //     },
  //     on: (
  //       messageType: keyof ToProtocol,
  //       handler: (message: Message) => any,
  //     ) => {
  //       // Need to keep track of stuff?
  //     },
  //     request: (messageType: keyof FromProtocol, data: any) => {
  //       return this.request(messageType, data);
  //     },
  //   };
  // }

  protected _send(message: Message) {
    throw new Error("Not implemented");
  }

  send<T extends keyof FromProtocol>(
    messageType: T,
    message: any,
    _messageId?: string,
  ): string {
    const messageId = _messageId ?? uuidv4();
    const data: Message = {
      messageType: messageType as string,
      data: message,
      messageId,
    };
    this._send(message);
    return messageId;
  }

  protected handleMessage(msg: Message) {
    if (msg.messageType === undefined || msg.messageId === undefined) {
      throw new Error(`Invalid message sent: ${JSON.stringify(msg)}`);
    }

    // Call handler and respond with return value
    const listeners = this.typeListeners.get(msg.messageType as any);
    listeners?.forEach(async (handler) => {
      try {
        const response = await handler(msg);
        if (response && typeof response[Symbol.asyncIterator] === "function") {
          for await (const update of response) {
            this.send(msg.messageType, update, msg.messageId);
          }
          this.send(msg.messageType, { done: true }, msg.messageId);
        } else {
          this.send(msg.messageType, response || {}, msg.messageId);
        }
      } catch (e: any) {
        console.warn(`Error running handler for "${msg.messageType}": `, e);
        this._onErrorHandlers.forEach((handler) => {
          handler(e);
        });
      }
    });

    // Call handler which is waiting for the response, nothing to return
    this.idListeners.get(msg.messageId)?.(msg);
  }

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (message: Message<ToProtocol[T][0]>) => ToProtocol[T][1],
  ): void {
    if (!this.typeListeners.has(messageType)) {
      this.typeListeners.set(messageType, []);
    }
    this.typeListeners.get(messageType)?.push(handler);
  }

  request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]> {
    const messageId = uuidv4();
    return new Promise((resolve) => {
      const handler = (msg: Message) => {
        resolve(msg.data);
        this.idListeners.delete(messageId);
      };
      this.idListeners.set(messageId, handler);
      this.send(messageType, data, messageId);
    });
  }
}
