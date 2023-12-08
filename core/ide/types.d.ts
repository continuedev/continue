interface IDE {
  getSerializedConfig(): Promise<SerializedContinueConfig>;
}

export { IDE };
