local config = require('continue.config')

local debugPrint = function(msg)
  if config.debug then
    vim.schedule(function()
      vim.notify("DEBUG: " .. msg .. "\n", vim.log.levels.INFO)
    end)
  end
end


return {
  debug = debugPrint,
  error = function(msg)
    vim.schedule(function()
      vim.notify("ERROR: " .. msg .. "\n", vim.log.levels.ERROR)
    end)
  end
}
