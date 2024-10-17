local messenger         = require "continue.messenger"
local log               = require "continue.utils.log"

---@class ContinueProfile
---@field stream_manager StreamManager
---@field context_providers Stream
local ContinueProfile   = {}
ContinueProfile.__index = ContinueProfile

---@class SlashCommandDescription
---@field name string
---@field description string
---@field params? table<string, any>

---@alias ContextProviderType "normal" | "query" | "submenu"

---@class ContinueUIConfig
---@field codeBlockToolbarPosition? "top" | "bottom"
---@field fontSize? number
---@field displayRawMarkdown? boolean

---@class ContextProviderDescription
---@field title string
---@field displayTitle string
---@field description string
---@field renderInlineAs? string
---@field type ContextProviderType

---@class BaseCompletionOptions
---@field temperature? number
---@field topP? number
---@field topK? number
---@field minP? number
---@field presencePenalty? number
---@field frequencyPenalty? number
---@field mirostat? number
---@field stop? string[]
---@field maxTokens? number
---@field numThreads? number
---@field keepAlive? number
---@field raw? boolean
---@field stream? boolean

---@class BrowserSerializedContinueConfig
---@field allowAnonymousTelemetry? boolean
---@field models any[]
---@field systemMessage? string
---@field completionOptions? BaseCompletionOptions
---@field requestOptions? any
---@field slashCommands? SlashCommandDescription[]
---@field contextProviders? ContextProviderDescription[]
---@field disableIndexing? boolean
---@field disableSessionTitles? boolean
---@field userToken? string
---@field embeddingsProvider? string
---@field ui? ContinueUIConfig
---@field reranker? any
---@field experimental? any
---@field analytics? any
-- for other types, see: `continue/core/protocol/core.ts#L51`

---@param stream_manager StreamManager
function ContinueProfile.new(stream_manager)
  local self = setmetatable({}, ContinueProfile)

  self.stream_manager = stream_manager

  return self
end

function ContinueProfile:initilize()
  self:load_profile()
end

function ContinueProfile:load_profile()
  ---@param response {config: BrowserSerializedContinueConfig; profileId: string}
  messenger.request("config/getSerializedProfileInfo", {}, function(response)
    local profile = response.config
    ---@type CompletionItem[]
    local mentionsItems = {}
    -- convert contextProviders to mentionsItems
    for _, provider in ipairs(profile.contextProviders) do
      table.insert(mentionsItems, {
        word = provider.title,
        kind = provider.type,
        menu = provider.displayTitle,
        user_data = { has_submenu = provider.type == "submenu" }
      })
    end
    self.stream_manager:getStream('context_mentions_changed'):notify(mentionsItems)

    -- convert slashCommands to slash_commands
    ---@type CompletionItem[]
    local slashCommands = {}
    for _, command in ipairs(profile.slashCommands) do
      table.insert(slashCommands, {
        word = command.name,
        kind = "command",
        menu = command.description,
        user_data = { params = command.params }
      })
    end
    self.stream_manager:getStream('slash_commands_changed'):notify(slashCommands)
  end)
end

return ContinueProfile
