// Telemetry has been removed

export class TeamAnalytics {
  static async capture(_event: string, _properties: { [key: string]: any }) {}
  static async setup(..._args: any[]) {}
  static async shutdown() {}
}
