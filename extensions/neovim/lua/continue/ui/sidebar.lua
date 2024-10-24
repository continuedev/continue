local api = vim.api
local chat_buf, chat_win, input_buf, input_win, on_input_submit

local chat_input_completion = require('continue.ui.chat_input_completion')

local function lock_chat_buf()
    api.nvim_buf_set_option(chat_buf, 'modifiable', false)
end

local function unlock_chat_buf()
    api.nvim_buf_set_option(chat_buf, 'modifiable', true)
end

local function append_to_chat(content)
    if not chat_buf or not api.nvim_buf_is_valid(chat_buf) then
        return
    end

    vim.schedule(function()
        unlock_chat_buf()
        local lines = vim.split(content, "\n")
        api.nvim_buf_call(chat_buf, function()
            api.nvim_put(lines, 'l', true, true)
        end)
        lock_chat_buf()


        -- Scroll to the bottom
        if chat_win and api.nvim_win_is_valid(chat_win) then
            local chat_lines = api.nvim_buf_line_count(chat_buf)
            api.nvim_win_set_cursor(chat_win, { chat_lines, 0 })
        end

        vim.cmd('redraw')
    end)
end
local function create_sidebar()
    -- Save current window
    local current_win = api.nvim_get_current_win()

    -- Create chat buffer
    chat_buf = api.nvim_create_buf(false, true)
    api.nvim_buf_set_option(chat_buf, 'buftype', 'nofile')
    api.nvim_buf_set_option(chat_buf, 'bufhidden', 'hide')
    api.nvim_buf_set_option(chat_buf, 'swapfile', false)

    api.nvim_buf_set_option(chat_buf, 'statusline', '%{get(b:, "custom_status", "")}')

    -- Open a vertical split for the chat window
    vim.cmd('botright vsplit')
    chat_win = api.nvim_get_current_win()
    api.nvim_win_set_buf(chat_win, chat_buf)

    -- Set width of chat window
    api.nvim_win_set_width(chat_win, 40)


    -- Create input buffer
    input_buf = api.nvim_create_buf(false, true)
    -- api.nvim_buf_set_option(input_buf, 'buftype', 'prompt')

    -- Create input window
    vim.cmd('belowright split')
    input_win = api.nvim_get_current_win()
    api.nvim_win_set_buf(input_win, input_buf)

    -- Set height of input window
    api.nvim_win_set_height(input_win, 5)

    -- Set prompt for input buffer
    vim.fn.prompt_setprompt(input_buf, '')

    local title = "Title"
    -- Function to handle input submission
    _G.submit_input = function()
        local lines = api.nvim_buf_get_lines(input_buf, 0, -1, false)
        local text = table.concat(lines, '\n')

        local displayText = string.rep('-', 40) .. '\n' .. text .. '\n' .. string.rep('-', 40) .. '\n'

        append_to_chat(displayText)

        -- api.nvim_buf_add_highlight(chat_buf, -1, "Comment", #chat_lines - 1, 0, -1)

        -- Clear the input buffer
        api.nvim_buf_set_lines(input_buf, 0, -1, false, { '' })

        -- Scroll chat window to bottom
        local chat_lines = api.nvim_buf_line_count(chat_buf)
        api.nvim_win_set_cursor(chat_win, { chat_lines, 0 })

        if on_input_submit then
            on_input_submit(title, text)
        end
    end

    -- Set up keymaps for the input buffer
    local function set_keymaps()
        local opts = { noremap = true, silent = true }

        -- Enter to submit
        api.nvim_buf_set_keymap(input_buf, 'i', '<CR>', '<Esc>:lua submit_input()<CR>a', opts)

        -- Shift+Enter to add a new line
        api.nvim_buf_set_keymap(input_buf, 'i', '<S-CR>', '<CR>', opts)

        -- Ctrl+j to jump to chat window
        api.nvim_buf_set_keymap(input_buf, 'i', '<C-j>', '<Esc><C-w>k', opts)
        api.nvim_buf_set_keymap(input_buf, 'n', '<C-j>', '<C-w>k', opts)

        -- Ctrl+k to jump back to input window
        api.nvim_buf_set_keymap(chat_buf, 'n', '<C-k>', '<C-w>j', opts)
        -- Insert in chat buf jump to input window and start insert
        api.nvim_buf_set_keymap(chat_buf, 'n', '<C-k>', '<C-w>j:startinsert<CR>', opts)
        api.nvim_buf_set_keymap(chat_buf, 'i', '<C-k>', '<C-w>j:startinsert<CR>', opts)

        -- Fix delete behavior in input buffer
        api.nvim_buf_set_keymap(input_buf, 'i', '<BS>', '<C-R>=v:lua.handle_backspace()<CR>', opts)
    end

    -- Function to handle backspace in input buffer
    _G.handle_backspace = function()
        local cursor = api.nvim_win_get_cursor(0)
        local row, col = cursor[1], cursor[2]

        if col == 0 and row > 1 then
            -- If at the beginning of a line (but not the first line),
            -- join with the previous line
            api.nvim_command('normal! kJ')
            return ''
        else
            -- Otherwise, perform normal backspace
            return vim.api.nvim_replace_termcodes('<BS>', true, false, true)
        end
    end

    set_keymaps()

    lock_chat_buf()

    -- Enter insert mode in the input window
    api.nvim_set_current_win(input_win)
    vim.cmd('startinsert!')

    -- Set the input buf file type to ContinueInputBuf
    api.nvim_buf_set_option(input_buf, 'filetype', 'markdown')
    api.nvim_buf_set_option(chat_buf, 'filetype', 'markdown')

    chat_input_completion.setup_for_buffer(input_buf)

    -- Return to the original window
    api.nvim_set_current_win(current_win)
end

local function toggle_sidebar()
    if chat_win and api.nvim_win_is_valid(chat_win) then
        api.nvim_win_close(chat_win, true)
        api.nvim_win_close(input_win, true)
        chat_win = nil
        input_win = nil
        status_win = nil
    else
        create_sidebar()
    end
end

local current_line = 'AI: '

local function stream_response(content)
    if not chat_buf or not api.nvim_buf_is_valid(chat_buf) then
        return
    end

    unlock_chat_buf()
    -- If this is the first word, start a new line
    if current_line == 'AI: ' then
        api.nvim_buf_set_lines(chat_buf, -1, -1, false, { current_line })
    end

    -- Append the new word to the current line
    current_line = current_line .. content .. ' '

    -- Update the last line of the buffer using nvim_put
    vim.schedule(function()
        local lines = vim.split(content, "\n")
        api.nvim_buf_call(chat_buf, function()
            unlock_chat_buf()
            api.nvim_put(lines, 'c', true, true)
        end)
    end)

    -- Scroll to the bottom
    if chat_win and api.nvim_win_is_valid(chat_win) then
        local chat_lines = api.nvim_buf_line_count(chat_buf)
        api.nvim_win_set_cursor(chat_win, { chat_lines, #current_line })
    end
    lock_chat_buf()

    vim.cmd('redraw')
end

local function finish_response()
    current_line = 'AI: '
end



local ChatUI = {}
ChatUI.__index = ChatUI
function ChatUI.new(stream_manager)
    local self = setmetatable({}, ChatUI)
    self.streamManager = stream_manager
    for name, stream in pairs(self.streamManager.streams) do
        stream:subscribe(function(streamName, data)
            self:update(streamName, data)
        end)
    end
    return self
end

--- Update the chat UI with new data from a specific stream.
--- @param streamName string The name of the stream.
--- @param data table The data from the stream.
function ChatUI:update(streamName, data)
    if streamName == "chat_stream" then
        stream_response(data.chunk)
    end

    if streamName == "finish_response" then
        finish_response()
    end

    if streamName == "change_model" and chat_buf then
        api.nvim_buf_set_option(chat_buf, 'statusline', 'Model: ' .. data.model)
    end
end

function ChatUI:toggle()
    toggle_sidebar()
end

--- Set the callback function to be executed when input is submitted in the sidebar.
--- @param callback fun(title: string, text: string) The callback function to be executed when input is submitted.
function ChatUI:set_on_input_submit(callback)
    on_input_submit = callback
end

return ChatUI
