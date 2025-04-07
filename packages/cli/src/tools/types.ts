export interface Tool {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required: boolean;
    }
  >;
  run: (args: any) => Promise<string>;
}