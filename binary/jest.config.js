module.exports = {
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.ts?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
    "^.+\\.js$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]],
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", ".d.ts"],
  extensionsToTreatAsEsm: [".ts", ".d.ts"],
  // Remove or comment out the moduleNameMapper configuration
  moduleNameMapper: {
    "^(.*)\\.js$": "$1",
  },
};
