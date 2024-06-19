import { v4 as uuidv4 } from "uuid";
import type { IProtocol } from "core/protocol";
import { IMessenger, type Message } from "core/util/messenger";

export class MultiMessenger<
  ToProtocol extends IProtocol,
  FromProtocol extends IProtocol,
> implements IMessenger<ToProtocol, FromProtocol>
{
  private messengers: IMessenger<ToProtocol, FromProtocol>[] = [];
  private _onErrorHandlers: ((error: Error) => void)[] = [];

  constructor(messengers: IMessenger<ToProtocol, FromProtocol>[]) {
    this.messengers = messengers;
    this.messengers.forEach((m) => {
      m.onError((err) =>
        this._onErrorHandlers.forEach((handler) => handler(err)),
      );
    });
  }

  onError(handler: (error: Error) => void): void {
    this._onErrorHandlers.push(handler);
  }

  send<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
    messageId?: string,
  ): string {
    const _messageId = messageId ?? uuidv4();
    this.messengers.forEach((messenger) =>
      messenger.send(messageType, data, _messageId),
    );
    return _messageId;
  }

  on<T extends keyof ToProtocol>(
    messageType: T,
    handler: (
      message: Message<ToProtocol[T][0]>,
    ) => Promise<ToProtocol[T][1]> | ToProtocol[T][1],
  ): void {
    this.messengers.forEach((messenger) => messenger.on(messageType, handler));
  }

  async request<T extends keyof FromProtocol>(
    messageType: T,
    data: FromProtocol[T][0],
  ): Promise<FromProtocol[T][1]> {
    const promises = this.messengers.map((messenger) =>
      messenger.request(messageType, data),
    );
    return Promise.race(promises);
  }

  invoke<T extends keyof ToProtocol>(
    messageType: T,
    data: ToProtocol[T][0],
    messageId?: string,
  ): ToProtocol[T][1] {
    return this.messengers.map((messenger) =>
      messenger.invoke(messageType, data, messageId),
    )[0];
  }
}
