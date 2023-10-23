"""
Welcome to Continue!

This is a 2 minute tutorial.

It will walk you through the basic features:
1. Ask a question
2. Edit code
3. Debug

You can either
- follow the instructions on your own, or
- follow along by clicking the gray CodeLens buttons above the lines, in order, starting with "Begin Section"
"""

# region —————————————————————————— Part 1: Ask a question about code [⌘ M] ——————————————————————————


"""Step 1: Highlight the function below"""


def mysterious_function(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x


"""Step 2: Use the keyboard shortcut [⌘ M] to
select the code and toggle the Continue input box"""

"""Step 3: Ask a question and press Enter"""

# endregion

# region ————————————————————————————————— Part 2: Edit code [⌘ ⇧ M] —————————————————————————————————


# Step 1: Highlight this code
def mysterious_function(x):
    n = len(x)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
                swapped = True
        if swapped == False:
            break
    return x


"""Step 2: Use the keyboard shortcut [⌘ ⇧ M] to
select the code and toggle the /edit slash command"""

"""Step 3: Request an edit and press Enter"""

"""Step 4: Use keyboard shortcuts to
accept [⌘ ⇧ ↵] or reject [⌘ ⇧ ⌫] the edit"""

# endregion

# region ———————————————————————————— Part 3: Debug automatically [⌘ ⇧ R] ————————————————————————————


"""Step 1: Run this Python file"""


def print_sum(list_to_print):
    print(sum(list_to_print))


"""Step 2: Use the keyboard shortcut [⌘ ⇧ R]
to automatically debug the error"""
print_sum(["a", "b", "c"])

# endregion
