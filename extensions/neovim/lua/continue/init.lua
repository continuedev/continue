local M = {}
local api = vim.api

local ide_protocol = require('continue.ide_protocol')
local messenger = require('continue.messenger')
local config = require('continue.config')
-- local ui = require('continue.ui')
local ChatSidebar = require('continue.ui.sidebar')
local ChatHandler = require('continue.core.chat_handler')
local StreamManager = require('continue.core.stream')
local ContinueProfile = require('continue.core.continue_profile')
local chat_input_completion = require('continue.ui.chat_input_completion')


local function start_core_process()
  local use_tcp = true -- Set this to true for TCP communication

  if use_tcp then
    messenger.connect_tcp("127.0.0.1", 3000)
  else
    -- TODO fix it
    local core_path = config.get('core_path') or vim.fn.expand('${workspaceFolder}/binary/out/index.js')
    local env = {
      CONTINUE_DEVELOPMENT = "true",
      CONTINUE_GLOBAL_DIR = vim.fn.expand('${workspaceFolder}/binary/.continue')
    }
    local args = { "--development" }
    messenger.start_core_process(core_path, {
      cwd = vim.fn.expand('${workspaceFolder}/binary'),
      env = env,
      args = args
    })
  end
end
-- Initialize the plugin
function M.setup(opts)
  opts = opts or {}
  local stream_manager = StreamManager.new()

  stream_manager:createStream("chat_stream")
  stream_manager:createStream("finish_response")
  stream_manager:createStream("change_model")

  local continue_profile = ContinueProfile.new(stream_manager)

  local chat_handler = ChatHandler.new(stream_manager)
  local chat_sidebar = ChatSidebar.new(stream_manager)

  chat_input_completion.init_stream(stream_manager)

  messenger.on_connected = function()
    continue_profile:initilize()
    chat_handler:initialize()

    -- Send a test message
    local testMessage = [[

    analyze my @codebase

      ]]
    chat_handler:handle_chat_input("test", testMessage, {
      noContext = false
    })
    chat_sidebar:set_on_input_submit(function(title, text)
      chat_handler:handle_chat_input(title, text, {
        noContext = true
      })
    end)
  end
  -- Load and set configuration
  config.load_config_file()
  config.setup(opts)

  -- Call the function to start the core process
  start_core_process()

  -- Register IDE protocol handlers
  for method_name, method in pairs(ide_protocol) do
    messenger.on_core(method_name, method)
  end

  -- Set up commands
  vim.api.nvim_create_user_command('ContinueIndex', function()
    messenger.request("index/forceReIndex", {}, function() end)
  end, {})

  vim.api.nvim_create_user_command('ContinueOpenGUI', function()
    chat_sidebar:toggle()
    -- Implement GUI opening functionality
  end, {})

  -- Set up keybindings
  -- TODO: Implement keybindings
  -- local keybindings = config.get('keybindings')
  -- vim.api.nvim_set_keymap('n', keybindings.open_gui, ':ContinueOpenGUI<CR>', { noremap = true, silent = true })
  -- vim.api.nvim_set_keymap('v', keybindings.edit_code, ':ContinueEdit<CR>', { noremap = true, silent = true })

  -- Set up event listeners
  vim.api.nvim_create_autocmd("BufEnter", {
    pattern = "*",
    callback = function()
      local current_file = vim.fn.expand('%:p')
      messenger.request("onDidChangeActiveTextEditor", { filepath = current_file }, function() end)
    end,
  })
end

-- call setup
M.setup()

-- Expose the setup function
return M
