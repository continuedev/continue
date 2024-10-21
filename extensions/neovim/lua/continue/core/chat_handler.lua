local ChatHandler = {}
ChatHandler.__index = ChatHandler

local state = {
  chat_messages = {},
  active_model = 'gpt-4o',
  context_items = {},
  ---@type HistoryItem[]
  history = {},
  active = false
}

local messenger = require('continue.messenger')
local log = require('continue.utils.log')
-- local util = require('continue.util')

---@class ContextItem
---@field content string
---@field name string
---@field description string
---@field editing? boolean
---@field editable? boolean
---@field icon? string
---
---
---@class ContextItemId
---@field providerTitle string
---@field itemId string

---@class ContextItemWithId
---@field content string
---@field name string
---@field description string
---@field id ContextItemId
---@field editing? boolean
---@field editable? boolean
---@field icon? string

---@class ChatMessage
---@field role string
---@field content string
---
--- Ref: `core/index.d.ts` [MassagePart]
---@class MassagePart
---@field type 'text'|'imageUrl'
---@field text string

---@class HistoryItem
---@field message ChatMessage
---@field context_items ContextItem[]

---@class Modifiers
---@field noContext boolean

--- Create a new ChatHandler instance
---@param stream_manager StreamManager
function ChatHandler.new(stream_manager)
  local self = setmetatable({}, ChatHandler)
  self.streamManager = stream_manager
  self.defaultContextProviders = {} -- Set your default context providers here
  return self
end

--- Initialize the ChatHandler
function ChatHandler:initialize()
  self:get_list_models()
end

--- Push a message to a stream
---@param streamName string
---@param data table
function ChatHandler:push_message(streamName, data)
  local stream = self.streamManager:getStream(streamName)
  if stream then
    stream:push(data)
  else
    log.debug("Stream not found: " .. streamName)
  end
end

--- Get list of available models
function ChatHandler:get_list_models()
  messenger.request("llm/listModels", {}, function(data)
    -- TODO
    self:push_message("change_model", { model = "gpt-4o" })
  end)
end

--- Get active chat model
---@return table
function ChatHandler:get_activate_chat_model()
  return { model = state.active_model }
end

--- Get current file content
---@return string|nil
function ChatHandler:get_current_file_content()
  local current_file = vim.fn.expand('%:p')
  if current_file ~= '' then
    local content = vim.fn.readfile(current_file)
    return table.concat(content, '\n')
  end
  return nil
end

--- Construct messages from history
---@return ChatMessage[]
function ChatHandler:construct_messages()
  local msgs = {}
  local history = state.history
  log.debug("History: " .. vim.inspect(history))

  for i = 1, #history do
    local historyItem = history[i]

    local content
    if type(historyItem.message.content) == "table" then
      content = historyItem.message.content
    else
      content = { { type = "text", text = historyItem.message.content } }
    end

    -- Check if contextItems exists and is a table
    if historyItem.context_items and type(historyItem.context_items) == "table" then
      local ctxItems = {}
      for _, ctxItem in ipairs(historyItem.context_items) do
        table.insert(ctxItems, { type = "text", text = ctxItem.content .. "\n" })
      end

      -- Concatenate ctxItems and content
      for _, item in ipairs(ctxItems) do
        table.insert(content, 1, item)
      end
    end

    table.insert(msgs, {
      role = historyItem.message.role,
      content = content
    })
  end

  return msgs
end

--- Get slash command from input
---@param input string
---@return table|nil
function ChatHandler:get_slash_command(input)
  local slash_commands = {
    -- Define your slash commands here
    -- Example: { name = "edit", params = {} }
  }

  if input:sub(1, 1) == "/" then
    local command = input:match("^/(%w+)")
    for _, cmd in ipairs(slash_commands) do
      if cmd.name == command then
        return cmd
      end
    end
  end
  return nil
end

--- Resolve context based on modifiers
---@param modifiers Modifiers
---@return ContextItem[]
function ChatHandler:resolve_context(modifiers)
  -- Implement context resolution logic
  -- This is a placeholder implementation
  return {}
end

--- Stream normal input
---@param title string
function ChatHandler:stream_normal_input(title)
  local messages = self:construct_messages()
  log.debug("Chat messages: " .. vim.inspect(messages))

  messenger.stream_llm_chat(title, messages, {
    model = state.active_model,
    stream = true,
    log = true,
  }, function(chunk)
    self:push_message("chat_stream", { chunk = chunk })
  end, function(full_response)
    log.debug("Full response: " .. full_response)
    table.insert(state.chat_messages, {
      role = "assistant",
      content = full_response
    })
    self:push_message("finish_response", {})
    state.active = false
  end)
end

--- Stream slash command
---@param title string
---@param text string
---@param slash_command table
---@param context_items ContextItem[]
---@param selected_code table
function ChatHandler:stream_slash_command(title, text, slash_command, context_items, selected_code)
  -- TODO
  -- Implement slash command streaming logic
  -- This is a placeholder implementation
  log.debug("Streaming slash command: " .. slash_command.name)
end

--- Handle chat input
---@param title string
---@param text string
---@param modifiers Modifiers
function ChatHandler:handle_chat_input(title, text, modifiers)
  log.debug("start Handling chat input")
  log.debug("Handling chat input")
  local contextItems, selectedCode, parts = self:resolveEditorContent(text, modifiers)
  log.debug("Resolved editor content: " .. vim.inspect(contextItems))

  -- if not success then
  --   -- Handle error
  --   log.debug("Error in resolveEditorContent: " .. tostring(contextItems))
  --   return
  -- end

  -- Update state
  table.insert(state.history, {
    message = { role = "user", content = parts },
    context_items = contextItems
  })
  state.active = true

  -- Check for slash command
  local slashCommand = self:get_slash_command(text)

  if not slashCommand then
    self:stream_normal_input(title)
  else
    self:stream_slash_command(title, text, slashCommand, contextItems, selectedCode)
  end
end

--- Resolve editor content
--- @class MentionAttrs
--- @field label string
--- @field id string
--- @field itemType string
--- @field query string
---
---@class Range
---@field start Position
---@field ["end"] Position

---@class Position
---@field line number
---@field character number
---
--- @class RangeInFile
--- @field filepath string
--- @field range Range
---
---
---@param text string
---@param modifiers table
---@return ContextItemId[], RangeInFile[], MassagePart[]
---@async
function ChatHandler:resolveEditorContent(text, modifiers)
  ---@type MassagePart[]
  local parts = {}
  ---@type MentionAttrs[]
  local contextItemAttrs = {}

  ---@type RangeInFile[]
  local selectedCode = {}

  ---@type string|nil
  local slashCommand = nil

  -- Split the input text into paragraphs
  for paragraph in text:gmatch("[^\n]+") do
    local text, ctxItems, foundSlashCommand = self:resolveParagraph(paragraph)

    -- Only take the first slash command
    if foundSlashCommand and not slashCommand then
      slashCommand = foundSlashCommand
    end

    for _, item in ipairs(ctxItems) do
      table.insert(contextItemAttrs, item)
    end

    if text ~= "" then
      if #parts > 0 and parts[#parts].type == "text" then
        parts[#parts].text = parts[#parts].text .. "\n" .. text
      else
        table.insert(parts, { type = "text", text = text })
      end
    end
  end

  -- Parse code blocks
  -- TODO fix this?
  for codeblock in text:gmatch("```(.-)```") do
    local language, content = codeblock:match("^(%w+)\n(.*)$")
    if language and content then
      table.insert(selectedCode, {
        filepath = "input",
        range = {
          start = { line = 0, character = 0 },
          ["end"] = { line = select(2, content:gsub("\n", "\n")) + 1, character = 0 }
        }
      })
      table.insert(parts, { type = "text", text = "```" .. language .. "\n" .. content .. "\n```" })
    end
  end

  ---@type ContextItemWithId[]
  local contextItems = {}

  ---@type string
  local contextItemsText = ""

  for _, item in ipairs(contextItemAttrs) do
    local data = {
      -- item.itemType == "contextProvider" and
      name = item.id or item.itemType,
      query = item.query,
      fullInput = self:stripImages(parts),
      selectedCode = selectedCode
    }
    local resolvedItems = messenger.async_request("context/getContextItems", data)
    if resolvedItems == nil or next(resolvedItems) == nil then
      table.insert(contextItems, {
        content = "[System response] No context found for " ..
            item.label ..
            ", there may be an issue while query the indexing database, please tell user to check or try again.",
      })
    else
      log.debug("Resolved items: " .. vim.inspect(resolvedItems))
      for _, resolvedItem in ipairs(resolvedItems) do
        table.insert(contextItems, resolvedItem)
        contextItemsText = contextItemsText .. resolvedItem.content .. "\n\n"
      end
    end
  end

  -- Handle useCodebase modifier
  if modifiers.useCodebase then
    local codebaseItems = messenger.async_request("context/getContextItems", {
      name = "codebase",
      query = "",
      fullInput = self:stripImages(parts),
      selectedCode = selectedCode
    })
    if codebaseItems == nil or next(codebaseItems) == nil then
      table.insert(contextItems, {
        content = "[System response] No context found for codebase" ..
            ", there may be an issue while query the indexing database, please tell user to check or try again.",
      })
    else
      for _, codebaseItem in ipairs(codebaseItems) do
        table.insert(contextItems, codebaseItem)
        contextItemsText = contextItemsText .. codebaseItem.content .. "\n\n"
      end
    end
  end

  -- Include default context providers
  for _, provider in ipairs(self.defaultContextProviders or {}) do
    local items = messenger.async_request("context/getContextItems", {
      name = provider.name,
      query = provider.query or "",
      fullInput = self:stripImages(parts),
      selectedCode = selectedCode
    })
    if items == nil or next(items) == nil then
      table.insert(contextItems, {
        content = "[System response] No context found for name:" ..
            provider.name
            .. ", query:" .. provider.query ..
            ", there may be an issue while query the indexing database, please tell user to check or try again.",
      })
    else
      for _, item in ipairs(items) do
        table.insert(contextItems, item)
      end
    end
  end

  if contextItemsText ~= "" then
    contextItemsText = contextItemsText .. "\n"
  end

  if slashCommand then
    local lastTextIndex = self:findLastIndex(parts, function(part) return part.type == "text" end)
    local lastPart = slashCommand .. " " .. (parts[lastTextIndex] and parts[lastTextIndex].text or "")
    if #parts > 0 then
      parts[lastTextIndex].text = lastPart
    else
      parts = { { type = "text", text = lastPart } }
    end
  end

  return contextItems, selectedCode, parts
end

--- Resolve a paragraph
---@param paragraph string
---@return string, table, string|nil
function ChatHandler:resolveParagraph(paragraph)
  local text = ""
  local contextItems = {}
  local slashCommand = nil

  -- Helper function to split the paragraph into parts
  local function split(str)
    local parts = {}
    for part in str:gmatch("%S+") do
      table.insert(parts, part)
    end
    return parts
  end

  local parts = split(paragraph)

  for i, part in ipairs(parts) do
    if part:sub(1, 1) == "@" then
      -- Handle mention
      local mention = part:sub(2)
      text = text .. " " .. mention
      table.insert(contextItems, { label = mention, id = mention })
    elseif part:sub(1, 1) == "/" and slashCommand == nil then
      -- Handle slash command (only the first one)
      slashCommand = part:sub(2) -- Remove '/'
    else
      -- Handle regular text
      text = text .. (i > 1 and " " or "") .. part
    end
  end

  -- Trim start of the text
  text = text:match("^%s*(.*)") or ""

  return text, contextItems, slashCommand
end

--- Find the last index of an element that satisfies a predicate
---@param array table
---@param predicate function
---@return number
function ChatHandler:findLastIndex(array, predicate)
  for i = #array, 1, -1 do
    if predicate(array[i]) then
      return i
    end
  end
  return -1
end

--- Strip images from content and join text parts
---@param content table|string
---@return string
function ChatHandler:stripImages(content)
  -- If content is not a table (array), return it as is
  if type(content) ~= "table" then
    return content
  end

  local result = {}
  for _, part in ipairs(content) do
    if part.type == "text" then
      table.insert(result, part.text)
    end
  end

  -- Join the text parts with newline
  return table.concat(result, "\n")
end

return ChatHandler
