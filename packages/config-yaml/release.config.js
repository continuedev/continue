export default {
  branches: ["main"],
  tagFormat: "@continuedev/config-yaml@${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        releaseRules: [
          // Only release if commits affect this package
          { scope: "packages/config-yaml", release: "patch" },
          // { scope: "packages/config-yaml", type: "feat", release: "minor" },
          { scope: "packages/config-yaml", type: "fix", release: "patch" },
          { scope: "packages/config-yaml", breaking: true, release: "major" },
        ],
      },
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message:
          "chore(release): @continuedev/config-yaml@${nextRelease.version} [skip ci]",
      },
    ],
    "@semantic-release/github",
  ],
};
