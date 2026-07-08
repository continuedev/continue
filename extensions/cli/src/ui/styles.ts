import { Box } from "ink";

export const baseBoxStyles: React.ComponentProps<typeof Box> = {
  flexDirection: "column",
  paddingX: 2,
  paddingY: 1,
  borderStyle: "round",
};

export const defaultBoxStyles = (
  borderColor: string,
  overrides?: Partial<React.ComponentProps<typeof Box>>,
): React.ComponentProps<typeof Box> => ({
  ...baseBoxStyles,
  borderColor,
  ...overrides,
});
