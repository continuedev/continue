---
globs: gui/**/*
description: Ensures consistent URL opening behavior in GUI components using the
  IDE messenger pattern
alwaysApply: false
---

# GUI Link Opening

When adding functionality to open external links in GUI components, use `ideMessenger.post("openUrl", url)` where `ideMessenger` is obtained from `useContext(IdeMessengerContext)`
