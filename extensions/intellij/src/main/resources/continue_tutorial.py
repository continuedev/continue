"""
Welcome to Continue!

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


# region ————————————————————————————————— Part 2: Edit code [⌘ ⇧ J] —————————————————————————————————


"""Step 1: Highlight this code"""
def bubble_sort(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x

"""Step 2: Use the keyboard shortcut [⌘ ⇧ J] to
select the code and toggle the /edit slash command"""

"""Step 3: Request an edit and press enter"""
# e.g.) optimize this function
# e.g.) write comments

"""Step 4: Use keyboard shortcuts to
accept [⌘ ⇧ ↵] or reject [⌘ ⇧ ⌫] the edit"""

# endregion