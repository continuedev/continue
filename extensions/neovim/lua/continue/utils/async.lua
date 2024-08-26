local M = {}

-- Create a new task
local function new_task()
  local task = {
    _status = "pending",
    _result = nil,
    _callbacks = {}
  }

  function task:resolve(result)
    if self._status == "pending" then
      self._status = "resolved"
      self._result = result
      for _, callback in ipairs(self._callbacks) do
        vim.schedule(function()
          callback(result)
        end)
      end
    end
  end

  function task:reject(err)
    if self._status == "pending" then
      self._status = "rejected"
      self._result = err
      for _, callback in ipairs(self._callbacks) do
        vim.schedule(function()
          callback(nil, err)
        end)
      end
    end
  end

  function task:on_complete(callback)
    if self._status == "pending" then
      table.insert(self._callbacks, callback)
    else
      vim.schedule(function()
        callback(self._result)
      end)
    end
  end

  return task
end

-- Create an async function
function M.async(fn)
  return function(...)
    local args = { ... }
    local task = new_task()

    vim.schedule(function()
      fn(task, unpack(args))
    end)

    return task
  end
end

-- Sync function to run async functions synchronously
function M.sync(async_fn, ...)
  local result, error
  local done = false

  async_fn(...):on_complete(function(res, err)
    result = res
    error = err
    done = true
  end)

  vim.wait(5000, function() return done end, 10)

  if error then
    error(error)
  end
  return result
end

return M
