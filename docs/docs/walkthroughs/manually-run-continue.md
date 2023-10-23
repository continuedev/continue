---
title: Manually Run Continue
description: How to run Continue manually
keywords: [manual, firewall, vpn, air-gapped, self-host]
---

# Manually Run Continue

You might want to run Continue manually if

(a) a firewall, VPN, or other issue is stopping Continue from automatically downloading the server binary,

(b) you are on an OS where the binary fails to run (e.g. RHEL8),

(c) you are using an air-gapped computer,

(d) you want to self-host Continue, or

(e) you want to run from source while developing / modifying Continue's code.

In all cases, you should go to VS Code settings, search "continue" and check the box that says "Manually Running Server". This will stop Continue from trying to kill and redownload the server binary.

Next, you'll just need to start a server on your own, and then reload the VS Code window. Below are the 4 ways you can start a server.

## (Recommended) Use the `continuedev` PyPI package

The easiest way to run Continue is to

1. Download the `continuedev` PyPI package by running `pip install continuedev`
2. Start the server by running `python -m continuedev` in your terminal

## Download the server binary

If you'd like to use a pre-built binary, you can download manually from our S3 bucket. These are the download links for each OS:

- [MacOS (Intel)](https://continue-server-binaries.s3.us-west-1.amazonaws.com/mac/run)
- [MacOS (Apple Silicon)](https://continue-server-binaries.s3.us-west-1.amazonaws.com/apple-silicon/run)
- [Windows](https://continue-server-binaries.s3.us-west-1.amazonaws.com/windows/run.exe)
- [Linux](https://continue-server-binaries.s3.us-west-1.amazonaws.com/linux/run)

Once downloaded, start the binary by running `./continue_server` (MacOS/Linux) or `./continue_server.exe` (Windows) in the directory where you downloaded it. You should see that it begins listening on port 65432.

## Build the server binary from source

If you don't want to use the PyPI package, but need a version of Continue that works on an OS not listed above, then you can build the server binary from source.

1. Clone the [Continue repo](https://github.com/continuedev/continue)
2. Change directories into the repo: `cd continue`
3. Run the build script: `sh build.sh` (or `sh build.sh m1` if building for an M1 Mac, or `build.cmd` if on Windows without WSL)
4. Now that the binary is outputted in the `./dist` folder, start the server by running `./dist/continue_server`. You should see that it begins listening on port 65432.

## Run the server from source

If you want to develop or modify Continue's code, you can run the server from source. To do this, follow the instructions on development setup in our [CONTRIBUTING.md](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md#environment-setup).
