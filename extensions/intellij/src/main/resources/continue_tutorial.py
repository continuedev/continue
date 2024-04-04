"""
Welcome to Continue!

_________               _____ _____                       
__  ____/______ _______ __  /____(_)_______ ____  _______ 
_  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
/ /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
\____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/ 

This is a 2 minute tutorial.

It will walk you through two basic features:
1. Ask a question
2. Edit code
"""

# region —————————————————————————— Part 1: Ask a question about code [⌘ J] ——————————————————————————


"""Step 1: Highlight the function below"""


def mysterious_function(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x


"""Step 2: Use the keyboard shortcut [⌘ J] to
select the code and toggle the Continue input box"""

"""Step 3: Ask a question and press enter"""
# e.g.) what does this function do?
# e.g.) what should I call this function?

# endregion


# region ————————————————————————————————— Part 2: Edit code [⌘ I] —————————————————————————————————


"""Step 1: Highlight this code"""


def bubble_sort(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x


"""Step 2: Use the keyboard shortcut [⌘ I] to
select the code"""

"""Step 3: Type instructions to edit the code and press Enter"""
# e.g.) "optimize this function"
# e.g.) "edit write comments"

"""Step 4: Use keyboard shortcuts to
accept [⌥ ⇧ Y] or reject [⌥ ⇧ N] the edit"""

# endregion

# Ready to learn more? Check out the Continue documentation: https://continue.dev/docs