export default {
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    "(.+)\\.js": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  preset: "ts-jest/presets/default-esm",
  testTimeout: 10000,
};
