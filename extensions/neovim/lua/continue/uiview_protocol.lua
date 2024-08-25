local M = {}

---@class IndexingProgressUpdate
---@field progress number
---@field desc string
---@field shouldClearIndexes boolean|nil
---@field status "loading"|"indexing"|"done"|"failed"|"paused"|"disabled"
---@field debugInfo string|nil
---@param data IndexingProgressUpdate
M.indexProgress = function(data)
  local status_line = vim.fn.getbufvar(vim.fn.bufnr('%'), 'statusline')
  if status_line then
    local progress_str = string.format("[%.0f%%] %s", data.progress * 100, data.status)
    local new_status_line = status_line .. " " .. progress_str
    vim.fn.setbufvar(vim.fn.bufnr('%'), 'statusline', new_status_line)
  end

  -- Check if lualine plugin exists and add to it
  local ok, lualine = pcall(require, 'lualine')
  if ok then
    lualine.refresh({
      place = { 'statusline' },
      section = { 'x' },
      refresh = true,
      options = {
        component_separators = '',
        section_separators = '',
      },
      sections = {
        lualine_x = {
          {
            function()
              return string.format("[%.0f%%] %s", data.progress * 100, data.status)
            end,
            color = { fg = '#ffffff', bg = '#000000' }
          }
        }
      }
    })
  end
end
return M
