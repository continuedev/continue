export abstract class Messenger {
  abstract send(messageType: string, message: any): void;
  abstract onMessage(
    messageType: string,
    handler: (message: any) => void
  ): void;
}

export class IpcMessenger extends Messenger {
  send(messageType: string, message: any): void {
    console.log(`Sending message: ${messageType}`);
  }
  onMessage(messageType: string, handler: (message: any) => void): void {
    console.log(`Registering handler for message: ${messageType}`);
  }
}
