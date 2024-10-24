local M = {
  windows = {
    width = 30,
  },
  debug = true,
  -- Dry run mode, don't actually send chat stream to LLM,...
  dry_run = false,
}

local default_config = {
  core_path = vim.fn.expand('~/.local/share/continue/core'),
  telemetry_enabled = false,
  show_inline_tip = true,
  keybindings = {
    open_gui = '<leader>cc',
    edit_code = '<leader>ce',
  },
}

local config = vim.deepcopy(default_config)

function M.setup(opts)
  config = vim.tbl_deep_extend('force', config, opts or {})
end

function M.get(key)
  return config[key]
end

function M.set(key, value)
  config[key] = value
end

-- TODO load and create a default config file
function M.load_config_file()
  local config_path = vim.fn.expand('~/.config/continue/config.json')
  if vim.fn.filereadable(config_path) == 1 then
    local content = vim.fn.readfile(config_path)
    local ok, json_config = pcall(vim.fn.json_decode, table.concat(content, '\n'))
    if ok then
      config = vim.tbl_deep_extend('force', config, json_config)
    else
      vim.notify('Failed to parse Continue config file', vim.log.levels.ERROR)
    end
  end
end

function M.save_config_file()
  local config_path = vim.fn.expand('~/.config/continue/config.json')
  local content = vim.fn.json_encode(config)
  vim.fn.writefile({ content }, config_path)
end

return M
