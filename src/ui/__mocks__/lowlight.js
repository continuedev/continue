// Mock for lowlight
export const common = {};

export function createLowlight() {
  return {
    register: () => {},
    highlight: (lang, code) => ({
      children: [{ type: "text", value: code }],
    }),
    highlightAuto: (code) => ({
      children: [{ type: "text", value: code }],
    }),
  };
}
