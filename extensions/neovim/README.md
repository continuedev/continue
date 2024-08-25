This is a plugin for Neovim that connects to the Continue.dev core.

The plugin is in early development stage and is not ready for use.

## Contributing

If you want to contribute to the development of this plugin, please follow the instructions below.

### Prerequisites & setup

- See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for general prerequisites and setup.
- A working Neovim installation.

### Development & Debugging

1. Run the core debug server in VsCode. Open a VS Code window (we recommend this for a preconfigured Typescript debugging experience) with the `continue` repository. Select the `Core Binary` debug configuration and press play.
2. Run the plugin in Neovim. Open a terminal and navigate to the root of the `continue` repository.
   Run:

```bash
nvim -u NONE -c "set rtp+=${PWD}/extensions/neovim" "+set shortmess-=T" "+set verbose=1" -c "lua require('continue')" -c "lua vim.lsp.set_log_level('trace')" --headless ./manual-testing-sandbox/test.js

```

Note:
Note:

- The `--headless` flag is optional and can be removed if you want to see the Neovim UI.
- The `./manual-testing-sandbox/test.js` file is a test file that will be opened in the Neovim buffer. You can replace it with any file you want to test.
- The `set verbose=1` flag is optional and can be removed if you want to see less output in the terminal.

# Features:

- [x] Index codebase
- [ ] Write neovim debug instructions
- [ ] Codebase mention
- [ ] File mention
- [ ] Slash command
- [ ] Check for other providers
- [ ] Start core on neovim start (without TCP)
- [ ] Make the plugin easily installable
- [ ] Attractive sidebar UI
- [ ] Sidebar UI code blocks highlight
- [ ] Apply diff to the buffer
- [ ] Manage chat history
- [ ] Send message/code block from buffer
- [ ] Implement Tab-completion
- [ ] Make `transformer.js` works (Currently not working due to missing binary import)
- [ ] Verify all IDE protocol functions in `ide_protocol.lua` works as expected (mostly AI gen)
- [ ] Implement Github login to use `free-trial` API
- [ ] Implement Indexing status in the status line
- [ ] Update general docs
