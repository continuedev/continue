<<<<<<< HEAD
- Whenever adding links in the `gui` that direct to `continue.dev`, you should use an onClick handler that calls `ideMessenger.request("controlPlane/openUrl", { path, orgSlug: undefined });` instead of directly linking to the URL with an `href`.
=======
- Whenever adding links in the `gui` that direct to `continue.dev`, you should use the IDE's `openUrl` command to open the URL in the user's default browser.
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
