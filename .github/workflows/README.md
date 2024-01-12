# Deployment Process

## preview

When merging to `preview`:

- the VS Code extension along with Rust extension is built and uploaded as an artifact
- all of the artifacts are downloaded and pushed to the store/registry all at once, as full releases.
- the version is bumped and this change is commited to preview
- in the future, the Intellij extension will be built and uploaded to the marketplace here

## main

When merging to `main`:

- the VS Code extension along with Rust extension is built and uploaded as an artifact
- all of the artifacts are downloaded and pushed to the store/registry all at once, as full releases.
- the version is bumped and this change is commited to main
- in the future, the Intellij extension will be built and uploaded to the marketplace here
