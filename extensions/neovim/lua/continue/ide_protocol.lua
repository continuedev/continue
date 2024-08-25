local M = {}
local uv = vim.loop

local ok, git = pcall(require, "plenary.job")
if not ok then
  error("plenary.nvim is required for Git operations")
end

M.getCurrentFile = function()
  return vim.fn.expand('%:p')
end

M.openFile = function(data)
  local filepath = data.filepath
  vim.cmd('edit ' .. vim.fn.fnameescape(filepath))
end

M.readFile = function(data)
  local filepath = data.filepath
  local file = io.open(filepath, "r")
  if not file then return nil end
  local content = file:read("*all")
  file:close()
  return content
end

M.writeFile = function(data)
  local filepath = data.filepath
  local contents = data.contents
  local file = io.open(filepath, "w")
  if not file then return false end
  file:write(contents)
  file:close()
  return true
end

M.showLines = function(filepath, start_line, end_line)
  M.openFile(filepath)
  vim.api.nvim_win_set_cursor(0, { start_line, 0 })
  vim.cmd('normal! V' .. (end_line - start_line) .. 'j')
end

-- return string[]
M.getWorkspaceDirs = function()
  local workspace_dirs = {}

  -- Get all workspace folders
  local workspace_folders = vim.lsp.buf.list_workspace_folders()
  for _, folder in ipairs(workspace_folders) do
    table.insert(workspace_dirs, folder)
  end

  -- If no workspace folders, use the current working directory
  if #workspace_dirs == 0 then
    local cwd = vim.fn.getcwd()
    table.insert(workspace_dirs, cwd)
  end

  return workspace_dirs
end

M.getWorkspaceConfigs = function()
  local configs = {}
  local workspace_dirs = M.getWorkspaceDirs()

  for _, dir in ipairs(workspace_dirs) do
    local config_path = dir .. "/.continuerc.json"
    local f = io.open(config_path, "r")
    if f then
      local contents = f:read("*all")
      f:close()
      local success, parsed = pcall(vim.json.decode, contents)
      if success then
        table.insert(configs, parsed)
      end
    end
  end

  return configs
end

M.pathSep = function()
  return package.config:sub(1, 1)
end

M.fileExists = function(data)
  local filepath = data.filepath
  if type(filepath) ~= "string" then
    return false
  end
  return vim.loop.fs_stat(filepath) ~= nil
end

M.gotoDefinition = function(data)
  local location = data.location
  -- This requires LSP setup, which is not included here
  vim.lsp.buf.definition()
  return {} -- Should return RangeInFile[]
end

M.onDidChangeActiveTextEditor = function(callback)
  vim.api.nvim_create_autocmd("BufEnter", {
    callback = function()
      callback(M.getCurrentFile())
    end
  })
end

M.getGitHubAuthToken = function()
  -- This would require external configuration or a prompt
  return ""
end

M.infoPopup = function(data)
  vim.notify(data.message, vim.log.levels.INFO)
end

M.errorPopup = function(data)
  vim.notify(data.message, vim.log.levels.ERROR)
end

M.getRepoName = function(dir)
  -- This would require git integration, not implemented here
  return nil
end

M.getTags = function(data)
  local artifactId = data.artifactId
  -- This would require git integration, not implemented here
  return {}
end

M.getIdeInfo = function()
  return {
    ideType = "neovim",
    name = "Neovim",
    version = vim.version().major .. '.' .. vim.version().minor .. '.' .. vim.version().patch,
    remoteName = "local",
    extensionVersion = "0.1.0" -- Replace with actual plugin version
  }
end

M.readRangeInFile = function(data)
  local filepath = data.filepath
  local range = data.range
  local file = io.open(filepath, "r")
  if not file then return nil end
  local lines = {}
  for line in file:lines() do
    table.insert(lines, line)
  end
  file:close()
  local result = {}
  for i = range.start.line + 1, range["end"].line + 1 do
    table.insert(result, lines[i])
  end
  return table.concat(result, "\n")
end

M.getLastModified = function(data)
  local files = data.files
  local result = {}
  for _, file in ipairs(files) do
    local stat = vim.loop.fs_stat(file)
    if stat then
      result[file] = stat.mtime.sec
    end
  end
  return result
end

M.isTelemetryEnabled = function()
  -- This would depend on your plugin's configuration
  return false
end

M.getUniqueId = function()
  -- This would require generating or storing a unique ID
  return "neovim-unique-id"
end


-- Helper function to get workspace directories
local function getWorkspaceDirectories()
  return vim.fn.readdir(vim.fn.getcwd())
end

-- Helper function to check if a directory is a Git repository
local function isGitRepo(dir)
  local output = vim.fn.system(string.format("git -C %s rev-parse --is-inside-work-tree", dir))
  return vim.v.shell_error == 0
end

-- Helper function to get Git diff
local function getGitDiff(dir, staged)
  local command = staged and "git -C %s diff --staged" or "git -C %s diff"
  local output = vim.fn.system(string.format(command, dir))
  return output
end
M.getDiff = function()
  local diffs = {}
  local repos = {}

  for _, dir in ipairs(getWorkspaceDirectories()) do
    if isGitRepo(dir) then
      local fullPath = vim.fn.getcwd() .. "/" .. dir
      table.insert(repos, dir)

      local staged = getGitDiff(fullPath, true)
      local unstaged = getGitDiff(fullPath, false)

      table.insert(diffs,
        string.format("Repository: %s\n\nStaged changes:\n%s\n\nUnstaged changes:\n%s", dir, staged, unstaged))
    end
  end

  local fullDiff = table.concat(diffs, "\n\n" .. string.rep("-", 40) .. "\n\n")
  if fullDiff:match("^%s*$") then
    return "No changes"
  end

  return fullDiff
end

M.getTerminalContents = function()
  -- This would require terminal integration, not implemented here
  return ""
end

M.getDebugLocals = function(data)
  local threadIndex = data.threadIndex
  -- This would require debugger integration, not implemented here
  return ""
end

M.getTopLevelCallStackSources = function(data)
  local threadIndex = data.threadIndex
  local stackDepth = data.stackDepth
  -- This would require debugger integration, not implemented here
  return {}
end

M.getAvailableThreads = function(data)
  -- This would require debugger integration, not implemented here
  return {}
end

M.listFolders = function()
  -- This would require traversing the file system
  return {}
end

M.getContinueDir = function()
  -- This would depend on your plugin's configuration
  return vim.fn.expand('~/.continue')
end

M.showVirtualFile = function(data)
  local title = data.title
  local contents = data.contents
  vim.cmd('new')
  local buf = vim.api.nvim_get_current_buf()
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(contents, "\n"))
  vim.api.nvim_buf_set_name(buf, title)
  vim.api.nvim_buf_set_option(buf, 'buftype', 'nofile')
  vim.api.nvim_buf_set_option(buf, 'bufhidden', 'hide')
  vim.api.nvim_buf_set_option(buf, 'swapfile', false)
end

M.runCommand = function(data)
  local command = data.command
  return vim.fn.system(command)
end


M.saveFile = function(data)
  local filepath = data.filepath
  vim.cmd('write ' .. vim.fn.fnameescape(filepath))
end

M.showDiff = function(data)
  local filepath = data.filepath
  local newContents = data.newContents
  local stepIndex = data.stepIndex
  -- This would require implementing a diff view, not included here
end

M.getOpenFiles = function()
  local buffers = vim.api.nvim_list_bufs()
  local open_files = {}
  for _, buf in ipairs(buffers) do
    if vim.api.nvim_buf_is_loaded(buf) then
      table.insert(open_files, vim.api.nvim_buf_get_name(buf))
    end
  end
  return open_files
end

M.getPinnedFiles = function()
  -- Neovim doesn't have a built-in concept of pinned files
  return {}
end

M.getSearchResults = function(data)
  local query = data.query
  -- This would require implementing a search function, not included here
  return ""
end

M.getProblems = function(data)
  local filepath = data.filepath
  -- This would require LSP integration, not included here
  return {}
end

M.subprocess = function(data)
  local command = data.command
  local handle = io.popen(command)
  local result = handle:read("*a")
  handle:close()
  return result, ""
end

M.getBranch = function(data)
  local dir = data.dir
  local handle = io.popen("git -C " .. dir .. " rev-parse --abbrev-ref HEAD 2>&1")
  if handle then
    local result = handle:read("*a")
    handle:close()
    result = result:gsub("^%s*(.-)%s*$", "%1") -- Trim whitespace
    if result:find("fatal:") then
      return ""                                -- Not a git repository or other error
    else
      return result
    end
  end
  return ""
end

M.getGitRootPath = function(data)
  local dir = data.dir
  local handle = io.popen("git -C " .. dir .. " rev-parse --show-toplevel 2>&1")
  if handle then
    local result = handle:read("*a")
    handle:close()
    result = result:gsub("^%s*(.-)%s*$", "%1") -- Trim whitespace
    if result:find("fatal:") then
      return nil                               -- Not a git repository or other error
    else
      return result
    end
  end
  return nil
end


local FileType = {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

local function list_dir(dir)
  local results = {}
  local handle = uv.fs_scandir(dir)

  if not handle then
    return nil, "Failed to open directory: " .. dir
  end

  while true do
    local name, type = uv.fs_scandir_next(handle)
    if not name then break end

    local fileType = FileType.Unknown
    if type == 'file' then
      fileType = FileType.File
    elseif type == 'directory' then
      fileType = FileType.Directory
    elseif type == 'link' then
      fileType = FileType.SymbolicLink
    end

    table.insert(results, { name, fileType })
  end

  return results
end


M.listDir = function(data)
  local dir = data.dir
  local entries, err = list_dir(dir)
  if err then
    vim.notify("Error listing directory: " .. err, vim.log.levels.ERROR)
    return nil
  end
  return entries
end

M.getIdeSettings = function()
  -- This would depend on your plugin's configuration
  return {
    remoteConfigServerUrl = nil,
    remoteConfigSyncPeriod = 60,
    userToken = "",
    enableControlServerBeta = false,
    pauseCodebaseIndexOnStart = false,
    enableDebugLogs = false,
  }
end

function M.getControlPlaneSessionInfo()
  return {
    accessToken = "",
    account = {
      id = "",
      label = "",
    }
  }
end

return M
