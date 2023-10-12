# Deployment Process

## preview
When merging to `preview`:
- on each platform, a PyInstaller binary is built and placed in the extension directory. Then the extension is built and tested and uploaded as an artifact.
- all of the artifacts are downloaded (and the Apple Silicon downloaded from S3 bucket) and pushed to the store/registry all at once, as pre-releases.
- the version is bumped and this change is commited to preview

## main
When merging to `main`:

> Make sure to sh build.sh m1 and push to the S3 bucket before merging to main, so that the newest Apple Silicon binary is available to package with the extension.

- the continuedev package is built and uploaded to PyPI. Then the version is bumped and this change is commited to main.
- on each platform, a PyInstaller binary is built and placed in the extension directory. Then the extension is built and tested and uploaded as an artifact. The PyInstaller binary is also uploaded as an artifact.
- all of the artifacts are downloaded (and the Apple Silicon downloaded from S3 bucket) and pushed to the store/registry all at once, as full releases.
- the version is bumped and this change is commited to main
- at the end, all of the PyInstaller binaries are uploaded to the S3 bucket because they are needed for JetBrains still.
- in the future, the Intellij extension will be built and uploaded to the marketplace here