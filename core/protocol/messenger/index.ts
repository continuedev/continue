import { v4 as uuidv4 } from "uuid";

import type { IProtocol } from "../index";

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
  onError(handler: (message: Message, error: Error) => void): void;
  send<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
    messageId?: string,
  ): string;

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (
      message: Message<ToProtocol[T][0]>,
    ) => Promise<ToProtocol[T][1]> | ToProtocol[T][1],
  ): void;

  request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]>;

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
    messageId?: string,
  ): ToProtocol[T][1];
}

export class InProcessMessenger<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> implements IMessenger<ToProtocol, FromProtocol>
{
  // Listeners for the entity that owns this messenger (right now, always Core)
  protected myTypeListeners = new Map<
    keyof ToProtocol,
    (message: Message) => any
  >();

  // Listeners defined by the other side of the protocol (right now, always IDE)
  protected externalTypeListeners = new Map<
    keyof FromProtocol,
    (message: Message) => any
  >();

  protected _onErrorHandlers: ((message: Message, error: Error) => void)[] = [];

  onError(handler: (message: Message, error: Error) => void) {
    this._onErrorHandlers.push(handler);
  }

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
    messageId?: string,
  ): ToProtocol[T][1] {
    const listener = this.myTypeListeners.get(messageType);
    if (!listener) {
      return;
    }

    const msg: Message = {
      messageType: messageType as string,
      data,
      messageId: messageId ?? uuidv4(),
    };
    return listener(msg);
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
    this.externalTypeListeners.get(messageType)?.(data);
    return messageId;
  }

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (message: Message<ToProtocol[T][0]>) => ToProtocol[T][1],
  ): void {
    this.myTypeListeners.set(messageType, handler);
  }

  async request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]> {
    const messageId = uuidv4();
    const listener = this.externalTypeListeners.get(messageType);
    if (!listener) {
      throw new Error(`No handler for message type "${String(messageType)}"`);
    }
    const response = await listener({
      messageType: messageType as string,
      data,
      messageId,
    });
    return response;
  }

  externalOn<T extends keyof FromProtocol>(
    messageType: T,
    handler: (message: Message) => any,
  ) {
    this.externalTypeListeners.set(messageType, handler);
  }

  externalRequest<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
    _messageId?: string,
  ): Promise<ToProtocol[T][1]> {
    const messageId = _messageId ?? uuidv4();
    const listener = this.myTypeListeners.get(messageType);
    if (!listener) {
      throw new Error(`No handler for message type "${String(messageType)}"`);
    }
    const response = listener({
      messageType: messageType as string,
      data,
      messageId,
    });
    return Promise.resolve(response);
  }
}
