local log    = require('continue.utils.log')
local config = require('continue.config')
local M      = {}
local json   = {}
local function logInfo(message)
  log.debug(message)
end

local function logError(message)
  vim.schedule(function()
    vim.notify("[ERROR] " .. message .. "\n", vim.log.levels.ERROR)
  end)
end

function json.encode(data)
  return vim.json.encode(data)
end

function json.decode(str)
  local success, result = pcall(vim.json.decode, str)
  if success then
    return result
  else
    -- Only log the first and last 50 characters of the result to avoid spamming the log
    logError("Error decoding JSON: " .. string.sub(tostring(result), 1, 50) .. "..." .. string.sub(tostring(result), -50))
    return nil
  end
end

local ide_protocol = require('continue.ide_protocol')
local uiview_protocol = require('continue.uiview_protocol')

---@alias pass_through_to_core_message_type
---| "update/modelChange"
---| "ping"
---| "abort"
---| "history/list"
---| "history/delete"
---| "history/load"
---| "history/save"
---| "devdata/log"
---| "config/addOpenAiKey"
---| "config/addModel"
---| "config/ideSettingsUpdate"
---| "config/getSerializedProfileInfo"
---| "config/deleteModel"
---| "config/newPromptFile"
---| "config/reload"
---| "context/getContextItems"
---| "context/loadSubmenuItems"
---| "context/addDocs"
---| "autocomplete/complete"
---| "autocomplete/cancel"
---| "autocomplete/accept"
---| "command/run"
---| "llm/complete"
---| "llm/streamComplete"
---| "llm/streamChat"
---| "llm/listModels"
---| "streamDiffLines"
---| "stats/getTokensPerDay"
---| "stats/getTokensPerModel"
---| "index/setPaused"
---| "index/forceReIndex"
---| "index/indexingProgressBarInitialized"
---| "completeOnboarding"
---| "addAutocompleteModel"
---| "config/listProfiles"
---| "profiles/switch"
---| "didChangeSelectedProfile"
--- To referrence the request and response types for each message type, see `core/protocol/core.ts`
--- {[message_type]: [request_type, response_type]}

-- Table to store response callbacks
---@type table<pass_through_to_core_message_type, fun(data: any)>
local response_listeners = {}
local manual_remove_listeners = {}

-- Core process handle
---@type userdata|nil
local core_process = nil

-- Generate a unique message ID
---@return string
local function generate_message_id()
  -- random number
  return tostring(math.random(1, 1000000))
end

-- Write a message to the core process
---@param message table
local function write_to_core(message)
  log.debug("Writing to core: " .. vim.inspect(message))
  local _message = json.encode(message) .. '\r\n'
  if core_process and not core_process:is_closing() then
    pcall(function()
      core_process:stdin():write(_message)
    end)
  elseif M.write then
    -- Use the TCP write function if available
    pcall(M.write, _message)
  else
    logError("Error: No core process or TCP connection available")
  end
end

-- Handle incoming messages from the core process
---@param message_str string
local function handle_message(message_str)
  local message = json.decode(message_str)
  if not message then
    logError("Error decoding message: " .. message_str)
    return
  end
  logInfo("Message received: " .. message_str .. "\n")

  ---@type string
  local message_id = message.messageId
  ---@type string
  local message_type = message.messageType
  ---@type any
  local data = message.data

  if response_listeners[message_id] then
    response_listeners[message_id](data)
    if manual_remove_listeners[message_id] == nil then
      response_listeners[message_id] = nil
    end
  elseif ide_protocol[message_type] then
    local success, result = pcall(ide_protocol[message_type], data)
    if success then
      write_to_core({
        messageId = message_id,
        messageType = message_type,
        data = result
      })
    else
      logError("[lua] Error executing " .. message_type .. ": " .. tostring(result))
    end
  elseif uiview_protocol and uiview_protocol[message_type] then
    logInfo("Handling uiview message type: " .. message_type)
    uiview_protocol[message_type](data)
  else
    logError("Unhandled message type: " .. message_type)
  end
end

-- Start the core process
-- TODO fix this
-- This function is not working properly
---@param core_path string Path to the core executable
function M.start_core_process(core_path)
  print("Starting core process" .. core_path)
  core_process = vim.loop.spawn(core_path, {
    args = {},
    stdio = { true, true, true },
  }, function(code, signal)
    print("Core process exited with code: " .. code)
  end)


  core_process:stdout():read_start(function(err, data)
    assert(not err, err)
    if data then
      handle_message(data)
    end
  end)
  M.on_init_success()
  logInfo("Core process started")
end

-- Send a request to the core process
---@param message_type pass_through_to_core_message_type
---@param data table
---@param callback fun(response: any)
function M.request(message_type, data, callback)
  local message_id = generate_message_id()
  response_listeners[message_id] = callback
  write_to_core({
    messageId = message_id,
    messageType = message_type,
    data = data
  })
end

-- async request
---@param message_type pass_through_to_core_message_type
---@param data table
---@return any
M.async_request = function(message_type, data)
  local message_id = generate_message_id()
  local done = false
  local response = nil
  response_listeners[message_id] = function(_response)
    response_listeners[message_id] = nil
    done = true
    response = _response
  end
  write_to_core({
    messageId = message_id,
    messageType = message_type,
    data = data
  })
  vim.wait(6000, function() return done end, 10)
  return response
end

-- Register a handler for uiview messages
---@param message_type string
---@param handler fun(data: any, callback: fun(response: any))
function M.on_uiview(message_type, handler)
  if not uiview_protocol then
    uiview_protocol = {}
  end
  uiview_protocol[message_type] = handler
end

-- Register a handler for core messages
---@param message_type string
---@param handler fun(data: any): any
function M.on_core(message_type, handler)
  ide_protocol[message_type] = handler
end

function M.connect_tcp(host, port)
  local client = vim.loop.new_tcp()
  local is_connecting = false
  local is_connected = false

  local function connect()
    if is_connecting or is_connected then
      return
    end
    client = vim.loop.new_tcp()

    is_connecting = true
    client:connect(host, port, function(err)
      is_connecting = false
      if err then
        logError("Error connecting to TCP server: " .. err)
        client:close()
        vim.defer_fn(connect, 1000) -- Attempt to reconnect after 1 second
        return
      end
      is_connected = true
      logInfo("Connected to TCP server")
      vim.defer_fn(function()
        M.on_init_success()
      end, 3000)
      client:read_start(function(read_err, chunk)
        if read_err then
          logError("Error reading from TCP server: " .. read_err)
          is_connected = false
          client:close()
          vim.defer_fn(connect, 1000) -- Attempt to reconnect after 5 seconds
          return
        end
        if chunk then
          local co = coroutine.create(function()
            local success, result = pcall(function()
              local messages = vim.split(chunk, "\r\n", true)
              for _, message in ipairs(messages) do
                if message ~= "" then
                  handle_message(message)
                end
              end
            end)
            if not success then
              logError("Error handling message: " .. tostring(result))
            end
          end)
          vim.schedule(function()
            local success, error = coroutine.resume(co)
            if not success then
              logError("Error in coroutine: " .. tostring(error))
              -- Continue processing despite the coroutine error
            end
          end)
        else
          -- EOF received, connection closed
          logInfo("Connection closed by server")
          is_connected = false
          client:close()
          vim.defer_fn(connect, 1000) -- Attempt to reconnect after 1 second
        end
      end)
    end)
  end

  connect() -- Initial connection attempt

  M.write = function(message)
    if not is_connected then
      logError("Cannot write: TCP connection is not active")
      vim.defer_fn(function()
        M.write(message) -- Attempt to write again after a delay
      end, 1000)         -- Delay for 1 second before retrying
      return
    end
    pcall(function()
      client:write(message)
    end)
  end

  return client
end

---@class LLMFullCompletionOptions
---@field temperature? number Temperature for sampling
---@field topP? number Top-p sampling
---@field topK? number Top-k sampling
---@field minP? number Minimum probability for sampling
---@field presencePenalty? number Presence penalty
---@field frequencyPenalty? number Frequency penalty
---@field mirostat? number Mirostat sampling
---@field stop? string[] Stop sequences
---@field maxTokens? number Maximum number of tokens to generate
---@field numThreads? number Number of threads to use
---@field keepAlive? number Keep-alive duration
---@field raw? boolean Whether to return raw output
---@field stream? boolean Whether to stream the response
---@field log? boolean Whether to log the request
---@field model? string Model to use

-- Stream LLM chat request
---@param model_title string
---@param messages table
---@param options LLMFullCompletionOptions
---@param on_chunk fun(chunk: string)
---@param on_finish fun(full_response: string)
function M.stream_llm_chat(model_title, messages, options, on_chunk, on_finish)
  local message_id = generate_message_id()
  local is_done = false
  manual_remove_listeners[message_id] = true
  local full_response = ""
  if config.dry_run then
    logInfo("[Dry Run] stream_llm_chat: " .. vim.inspect(messages))
    return
  end


  -- Set up the response listener
  response_listeners[message_id] = function(data)
    if data.done then
      is_done = true
      on_finish(full_response)
      manual_remove_listeners[message_id] = nil
    else
      on_chunk(data.content)
      full_response = full_response .. data.content
    end
  end

  -- Send the initial request
  write_to_core({
    messageId = message_id,
    messageType = "llm/streamChat",
    data = {
      messages = messages,
      title = model_title,
      completionOptions = options,
    }
  })

  -- Return a function to abort the stream
  return function()
    if not is_done then
      manual_remove_listeners[message_id] = nil
      write_to_core({
        messageId = message_id,
        -- TODO: Check if this is the correct message type
        messageType = "abort",
        data = nil
      })
      on_finish(full_response .. "\n---\n[User aborted]")
    end
  end
end

-- on init success
function M.on_init_success()
  if M.on_connected then
    M.on_connected()
  end
  M.request("ping", 'ping', function(response)
    logInfo("Ping response: " .. response)
  end)
  -- send index/indexingProgressBarInitialized
  -- M.request("index/indexingProgressBarInitialized", {}, function(response)
  --     print("Indexing progress bar initialized response: " .. response)
  -- end)

  -- M.request("index/forceReIndex", {
  --   shouldClearIndexes = true
  -- }, function(response)
  --   -- print("Indexing force reindex response: " .. response)
  -- end)
end

M.on_connected = nil

return M

--[[
Available message types:

IDE Protocol:
- readRangeInFile
- isTelemetryEnabled
- getUniqueId
- getWorkspaceConfigs
- getDiff
- getTerminalContents
- getWorkspaceDirs
- showLines
- listFolders
- getContinueDir
- writeFile
- fileExists
- showVirtualFile
- openFile
- runCommand
- saveFile
- readFile
- showDiff
- getOpenFiles
- getCurrentFile
- getPinnedFiles
- getSearchResults
- getProblems
- subprocess
- getBranch
- getIdeInfo
- getIdeSettings
- errorPopup
- getRepoName
- listDir
- getGitRootPath
- getLastModified
- insertAtCursor
- applyToFile
- getGitHubAuthToken
- setGitHubAuthToken
- pathSep
- getControlPlaneSessionInfo
- logoutOfControlPlane

uiview Protocol:
- showFile
- openConfigJson
- readRangeInFile
- toggleDevTools
- applyToCurrentFile
- showTutorial
- openUrl
- insertAtCursor

Core Protocol:
- configUpdate
- getDefaultModelTitle
- indexProgress
- refreshSubmenuItems
- didChangeAvailableProfiles

Other:
- getDebugLocals
- getAvailableThreads
- getTopLevelCallStackSources
- infoPopup
]]

--[[
    private val PASS_THROUGH_TO_CORE = listOf(
        "update/modelChange",
        "ping",
        "abort",
        "history/list",
        "history/delete",
        "history/load",
        "history/save",
        "devdata/log",
        "config/addOpenAiKey",
        "config/addModel",
        "config/ideSettingsUpdate",
        "config/getSerializedProfileInfo",
        "config/deleteModel",
        "config/newPromptFile",
        "config/reload",
        "context/getContextItems",
        "context/loadSubmenuItems",
        "context/addDocs",
        "autocomplete/complete",
        "autocomplete/cancel",
        "autocomplete/accept",
        "command/run",
        "llm/complete",
        "llm/streamComplete",
        "llm/streamChat",
        "llm/listModels",
        "streamDiffLines",
        "stats/getTokensPerDay",
        "stats/getTokensPerModel",
        "index/setPaused",
        "index/forceReIndex",
        "index/indexingProgressBarInitialized",
        "completeOnboarding",
        "addAutocompleteModel",
        "config/listProfiles",
        "profiles/switch",
        "didChangeSelectedProfile",
    )
]]
