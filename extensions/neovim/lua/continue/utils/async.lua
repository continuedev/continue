local function executeCoroutine(co)
  local results = {}
  local success, result
  repeat
    success, result = coroutine.resume(co)
    if success then
      table.insert(results, result)
    else
      error(result)       -- This will throw an error if the coroutine fails
    end
  until coroutine.status(co) == "dead"
  return unpack(results)
end

return {
  executeCoroutine = executeCoroutine
}
