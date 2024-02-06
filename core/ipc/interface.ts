import { Messenger } from "./messenger";

export class IpcInterface {
  private messenger: Messenger;
  constructor(messenger: Messenger) {
    this.messenger = messenger;
  }
}
