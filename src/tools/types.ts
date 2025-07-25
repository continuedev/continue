export type ToolParameters = Record<
  string,
  {
    type: string;
    description: string;
    required: boolean;
    items?: {
      type: string;
    };
  }
>;

export interface Tool {
  name: string;
  displayName: string;
  description: string;
  parameters: ToolParameters;
  run: (args: any) => Promise<string>;
  readonly?: boolean; // Indicates if the tool is readonly
}
