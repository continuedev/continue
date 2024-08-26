This is a plugin for Neovim that connects to the Continue.dev core.

The plugin is in early development stage and is not ready for use.

## Contributing

If you want to contribute to the development of this plugin, please follow the instructions below.

### Prerequisites & setup

- See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for general prerequisites and setup.
- A working Neovim installation.

### Git Workflow

To contribute to the plugin, please follow these steps:

- Fork and clone the my fork of the `continue` repository `https://github.com/qtnx/continue` to your local machine.
- Develop your changes then push them to your fork.
- Create a pull request from your fork to the `qtnx/continue` repository.
- Then your changes will be updated to my opening PR.
- For any questions or help for the NeoVim plugin, please create an issue in the `qtnx/continue` repository.

### Development & Debugging

1. **Core Debug Server Setup**:

To contribute to the plugin, please follow these steps:

- Open the `continue` repository in VS Code.
- Select the `Core Binary` debug configuration.
- Start the debugger.

2. **Running the Plugin in Neovim**:
   Navigate to the `continue` repository root and execute:

   ```bash
   nvim -u NONE -c "set rtp+=${PWD}/extensions/neovim" "+set shortmess-=T" "+lua require('continue')" -c "lua vim.lsp.set_log_level('trace')" --headless ./manual-testing-sandbox/test.js
   ```

   Notes:

   - Remove `--headless` to see the Neovim UI.
   - Remove `-u NONE` to load your own Neovim configuration.
   - Replace `./manual-testing-sandbox/test.js` with any test file.
   - Add `"+set verbose=1"` for more detailed output.
   - After starting Neovim, restart the core server in VS Code to establish the connection.

3. **Debugging the Plugin**:
   As Neovim lacks advanced debugging tools, use `print` statements in the plugin code. Output appears in the Neovim terminal.

   Tips:

   - Use `--headless` to view output directly in the terminal.
   - Disable debug logs by setting `debug = false` in `config.lua`.
   - Use `:messages` in Neovim to view logs, or press `ESC` repeatedly to skip floating logs.
   - Open the sidebar with `:ContinueOpenGUI`.
   - For visualize messages send and receive between Neovim and the core server, you can set a `Logpoint` in VS Code debugger at `continue/binary/src/TcpMessenger.ts` line 161 and 165. My message: `Received message from NeoVim {msg}`, `Send message to NeoVim {messageType} {data} {messageId}`

4. **Additional Debugging Techniques**:

   - Use `vim.inspect()` to pretty-print Lua tables and complex data structures.
   - Leverage Neovim's built-in `:lua` command to execute Lua code and inspect variables on the fly.

5. **Docs & References**:

   - There's not much API documentation for Continue.dev yet. However, you can deep-dive into the codebase to understand how things work. Or refer to the VS Code or JetBrains plugin code for inspiration.

6. **Performance Profiling**:

   - Use `:profile start profile.log` and `:profile func *` to start profiling.
   - Execute your plugin's functions.
   - Use `:profile stop` to end profiling and analyze the results in `profile.log`.

7. **Useful Commands for Development**:
   - `:luafile %` to quickly reload the current Lua file.
   - `:checkhealth` to diagnose potential issues with Neovim and plugins.

Remember to frequently test your changes and keep your development environment up-to-date.

8. Configuration

The free-trial option is not working yet, so you need to use the custom configuration before starting the core server.

Here's my configuration:

```json
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "${OPENAI_API_KEY}"
    }
  ],
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "<API_KEY>"
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "apiKey": "<API_KEY>"
    }
  },
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit highlighted code"
    },
    {
      "name": "comment",
      "description": "Write comments for the highlighted code"
    },
    {
      "name": "share",
      "description": "Export the current chat session to markdown"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command"
    }
  ],
  "customCommands": [
    {
      "name": "test",
      "prompt": "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "contextProviders": [
    { "name": "diff", "params": {} },
    {
      "name": "open",
      "params": {}
    },
    { "name": "terminal", "params": {} }
  ]
}
```

Please place this configuration in the `binary/.continue/config.json` file. Then restart the core server in VS Code.

# Features:

- [x] Estiblish connection from Neovim to Continue.dev core
- [x] Index codebase
- [x] A simple sidebar UI
- [x] Send and receive messages
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
