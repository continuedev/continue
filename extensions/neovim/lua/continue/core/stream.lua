local api = vim.api

-- Stream implementation
---@class Stream
---@field name string
---@field subscribers function[]
---@field new fun(name: string): Stream
---@field push fun(self: Stream, value: any)
---@field subscribe fun(self: Stream, callback: StreamCallback)
---@field notify fun(self: Stream, value: any)

---@alias StreamCallback fun(name: string, value: any)
local Stream = {}
Stream.__index = Stream

function Stream.new(name)
  local self = setmetatable({}, Stream)
  self.name = name
  self.subscribers = {}
  return self
end

function Stream:push(value)
  self:notify(value)
end

function Stream:subscribe(callback)
  table.insert(self.subscribers, callback)
end

function Stream:notify(value)
  for _, callback in ipairs(self.subscribers) do
    callback(self.name, value)
  end
end

---@class StreamManager
---@field streams table<string, Stream>
---@field new fun(): StreamManager
---@field createStream fun(self: StreamManager, name: string): Stream
---@field getStream fun(self: StreamManager, name: string): Stream|nil
local StreamManager = {}
StreamManager.__index = StreamManager

function StreamManager.new()
  local self = setmetatable({}, StreamManager)
  self.streams = {}
  return self
end

function StreamManager:createStream(name)
  if not self.streams[name] then
    self.streams[name] = Stream.new(name)
  end
  return self.streams[name]
end

function StreamManager:getStream(name)
  return self.streams[name]
end

return StreamManager
