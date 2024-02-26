export interface Message<T = any> {
  messageType: string;
  messageId: string;
  data: T;
}
