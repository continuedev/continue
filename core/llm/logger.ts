import {
  ILLMLogger,
  ILLMInteractionLog,
  LLMInteractionItem,
  LLMInteractionItemDetails,
} from "..";

type LLMLogItemFunction = (item: LLMInteractionItem) => void;

export class LLMLogger implements ILLMLogger {
  private nextId = 0;

  public createInteractionLog(): LLMInteractionLog {
    return new LLMInteractionLog(this, (this.nextId++).toString());
  }

  private logItemListeners: LLMLogItemFunction[] = [];

  onLogItem(listener: LLMLogItemFunction) {
    this.logItemListeners.push(listener);
  }

  public _logItem(item: LLMInteractionItem) {
    for (const listener of this.logItemListeners) {
      listener(item);
    }
  }
}

export class LLMInteractionLog implements ILLMInteractionLog {
  constructor(
    private logger: LLMLogger,
    public interactionId: string,
  ) {}

  logItem(item: LLMInteractionItemDetails) {
    this.logger._logItem({
      ...item,
      interactionId: this.interactionId,
      timestamp: Date.now(),
    });
  }
}
