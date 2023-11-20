export abstract class Messenger {
  abstract send(messageType: string, data: object): void;

  abstract onMessageType(
    messageType: string,
    callback: (data: object) => void
  ): void;

  abstract onMessage(
    callback: (
      messageType: string,
      data: any,
      ack?: (data: any) => void
    ) => void
  ): void;

  abstract onOpen(callback: () => void): void;

  abstract onClose(callback: () => void): void;

  abstract sendAndReceive(messageType: string, data: any): Promise<any>;

  abstract onError(callback: (error: any) => void): void;

  abstract close(): void;
}
