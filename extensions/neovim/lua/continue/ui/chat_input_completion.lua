local M = {}

local log = require('continue.utils.log')

--- @class CompletionItem
--- @field word string
--- @field kind string
--- @field menu string
--- @field has_submenu boolean
--- @field user_data table
--- @type CompletionItem[]
M.mentions = {}

--- @type CompletionItem[]
M.slash_commands = {}

-- Function to get completion items
function M.get_completion_items(prefix)
  local items = {}
  local candidates = prefix:sub(1, 1) == '@' and M.mentions or M.slash_commands

  for _, item in ipairs(candidates) do
    -- if vim.startswith(item.word, prefix) then
    table.insert(items, {
      word = vim.startswith(item.word, prefix) and item.word or (prefix .. item.word),
      kind = item.kind,
      menu = item.menu,
      user_data = { has_submenu = item.has_submenu },
    })
    -- end
  end

  return items
end

-- Function to get submenu items
local function get_submenu_items(mention)
  local items = M.mentions[mention] or {}
  local formatted_items = {}
  for _, item in ipairs(items) do
    table.insert(formatted_items, {
      word = item.word,
      kind = item.kind,
      menu = item.menu,
      user_data = { is_submenu_item = true }
    })
  end
  return formatted_items
end
-- Completion function
local function complete(findstart, base)
  if findstart == 1 then
    local line = vim.api.nvim_get_current_line()
    local col = vim.api.nvim_win_get_cursor(0)[2]
    local start = col

    while start > 0 and string.match(line:sub(start, start), '[%w@/]') do
      start = start - 1
    end

    return start
  else
    return M.get_completion_items(base)
  end
end

-- Function to show completion menu
function M.show_completion_menu()
  local line = vim.api.nvim_get_current_line()
  local col = vim.api.nvim_win_get_cursor(0)[2]
  local prefix = line:sub(1, col):match('@%w*$') or line:sub(1, col):match('/%w*$')

  if prefix then
    local items = M.get_completion_items(prefix)
    if #items > 0 then
      vim.fn.complete(col - #prefix + 1, items)
    end
  end
end

-- Function to handle item selection
local function on_item_selected()
  local completed_item = vim.v.completed_item
  if completed_item and completed_item.user_data and completed_item.user_data.has_submenu then
    local submenu_items = get_submenu_items(completed_item.word)
    if #submenu_items > 0 then
      vim.schedule(function()
        -- Delete the selected word
        local line = vim.api.nvim_get_current_line()
        local col = vim.fn.col('.')
        local start_col = col - #completed_item.word
        local new_line = line:sub(1, start_col - 1) .. line:sub(col)
        vim.api.nvim_set_current_line(new_line)

        -- Move the cursor to the start of the deleted word
        vim.api.nvim_win_set_cursor(0, { vim.fn.line('.'), start_col - 1 })

        -- Show submenu items
        local formatted_items = {}
        for _, item in ipairs(submenu_items) do
          table.insert(formatted_items, {
            word = item.word,
            kind = item.kind,
            menu = item.menu,
          })
        end
        vim.fn.complete(start_col, formatted_items)
      end)
    end
  end
end

-- Function to set up syntax highlighting
local function setup_highlighting(bufnr)
  vim.api.nvim_buf_add_highlight(bufnr, -1, 'MentionHighlight', 0, 0, -1)
  vim.api.nvim_buf_add_highlight(bufnr, -1, 'SlashCommandHighlight', 0, 0, -1)

  vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
    buffer = bufnr,
    callback = function()
      vim.api.nvim_buf_clear_namespace(bufnr, -1, 0, -1)
      local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
      for i, line in ipairs(lines) do
        for mention in line:gmatch('@%w+') do
          local start_col, end_col = line:find(mention, 1, true)
          if start_col then
            vim.api.nvim_buf_add_highlight(bufnr, -1, 'MentionHighlight', i - 1, start_col - 1, end_col)
          end
        end
        for slash_command in line:gmatch('/%w+') do
          local start_col, end_col = line:find(slash_command, 1, true)
          if start_col then
            vim.api.nvim_buf_add_highlight(bufnr, -1, 'SlashCommandHighlight', i - 1, start_col - 1, end_col)
          end
        end
      end
    end
  })
end

local function disable_other_completions(bufnr)
  -- Disable nvim-cmp
  if package.loaded['cmp'] then
    require('cmp').setup.buffer { enabled = false }
  end

  -- Disable built-in omnifunc and completefunc
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', '')
  vim.api.nvim_buf_set_option(bufnr, 'completefunc', '')

  -- Disable LSP completion
  for _, client in pairs(vim.lsp.get_active_clients({ bufnr = bufnr })) do
    client.server_capabilities.completionProvider = false
  end
end

-- Setup function
function M.setup(bufnr)
  bufnr = bufnr or 0 -- Use current buffer if not specified

  disable_other_completions(bufnr)

  -- Disable LSP completion for this buffer
  local client_id = vim.lsp.get_client_by_id(vim.b.lsp_client_id)
  if client_id then
    client_id.server_capabilities.completionProvider = false
  end

  -- Set up completion options
  vim.api.nvim_buf_set_option(bufnr, 'completeopt', 'menu,menuone,noselect')

  -- Set up omnifunc
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.require\'continue.ui.chat_input_completion\'.complete')

  -- Set up autocommands for triggering completion
  vim.api.nvim_create_autocmd("InsertCharPre", {
    buffer = bufnr,
    callback = function()
      M.check_trigger()
    end,
  })

  -- Set up autocommand for handling item selection
  vim.api.nvim_create_autocmd("CompleteDone", {
    buffer = bufnr,
    callback = function()
      on_item_selected()
    end,
  })

  -- Set up key mappings for navigation and selection
  local opts = { noremap = true, silent = true, expr = true }
  vim.api.nvim_buf_set_keymap(bufnr, 'i', '<Tab>', 'pumvisible() ? "<C-n>" : "<Tab>"', opts)
  vim.api.nvim_buf_set_keymap(bufnr, 'i', '<S-Tab>', 'pumvisible() ? "<C-p>" : "<S-Tab>"', opts)
  vim.api.nvim_buf_set_keymap(bufnr, 'i', '<CR>',
    'pumvisible() ? "<C-y>" : (complete_info().selected == -1 ? "<Esc>:lua submit_input()<CR>a" : "<C-y>")', opts)

  -- Set up syntax highlighting
  setup_highlighting(bufnr)

  -- Define highlight groups
  vim.api.nvim_command('highlight MentionHighlight guibg=#3a3a3a guifg=#ffffff')
  vim.api.nvim_command('highlight SlashCommandHighlight guibg=#2a2a2a guifg=#ffff00')
end

-- Function to check if completion should be triggered
function M.check_trigger()
  local char = vim.v.char
  if char == '@' or char == '/' then
    vim.schedule(function()
      M.show_completion_menu()
    end)
  end
end

-- Expose the complete function
M.complete = complete

-- Function to set up completion for a specific buffer
function M.setup_for_buffer(bufnr)
  M.setup(bufnr)
end

-- Function to add a mention
---@param stream_manager StreamManager
function M.init_stream(stream_manager)
  local context_mentions_stream = stream_manager:createStream('context_mentions_changed')
  ---@param value CompletionItem[]
  context_mentions_stream:subscribe(function(_, value)
    for _, item in ipairs(value) do
      table.insert(M.mentions, item)
    end
  end)
  local slash_commands_stream = stream_manager:createStream('slash_commands_changed')
  ---@param value CompletionItem[]
  slash_commands_stream:subscribe(function(_, value)
    for _, item in ipairs(value) do
      table.insert(M.slash_commands, item)
    end
  end)
end

return M
