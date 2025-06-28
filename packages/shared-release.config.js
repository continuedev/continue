export default function createReleaseConfig(packageName) {
  return {
    branches: ["main"],
    tagFormat: `@continuedev/${packageName}@\${version}`,
    plugins: [
      [
        "@semantic-release/commit-analyzer",
        {
          releaseRules: [
            { scope: `packages/${packageName}`, release: "patch" },
            { scope: `packages/${packageName}`, type: "fix", release: "patch" },
            { scope: "packages/config-yaml", type: "feat", release: "minor" },
            {
              scope: `packages/${packageName}`,
              breaking: true,
              release: "major",
            },
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
          message: `chore(release): @continuedev/${packageName}@\${nextRelease.version} [skip ci]`,
        },
      ],
      "@semantic-release/github",
    ],
  };
}
