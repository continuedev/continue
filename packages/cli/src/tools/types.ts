export type ToolParameters = Record<
  string,
  {
    type: string;
    description: string;
    required: boolean;
  }
>;

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  run: (args: any) => Promise<string>;
}
