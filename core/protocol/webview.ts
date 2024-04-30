export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  indexProgress: [{ progress: number; desc: string }, void];
};
