"""
_________               _____ _____                       
__  ____/______ _______ __  /____(_)_______ ____  _______ 
_  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
/ /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
\____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/ 

Welcome to Continue! This is a 2 minute tutorial.

You can either
- follow the instructions on your own, or
- follow along by clicking the gray CodeLens buttons above the lines, in order, starting with "Begin Section"
"""

# region —————————————————————————— Part 1: Ask a question about code [⌘ L] ——————————————————————————


"""Step 1: Highlight the function below"""


def mysterious_function(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x


"""Step 2: Use the keyboard shortcut [⌘ L] to
select the code and toggle the Continue input box"""

"""Step 3: Ask a question and press Enter"""

# endregion

# region ————————————————————————————————— Part 2: Edit code [⌘ I] —————————————————————————————————


"""Step 1: Highlight this code"""


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


"""Step 2: Use the keyboard shortcut [⌘ I] to edit"""

"""Step 3: Type "<your edit request>" and press Enter"""

"""Step 4: Use keyboard shortcuts to
accept [⌘ ⇧ ⏎] or reject [⌘ ⇧ ⌫] the edit"""

# endregion

# region ———————————————————————————— Part 3: Debug automatically [⌘ ⇧ R] ————————————————————————————


"""Step 1: Run this Python file (it should error!)"""


def print_sum(list_to_print):
    print(sum(list_to_print))


"""Step 2: Use the keyboard shortcut [⌘ ⇧ R]
to automatically debug the error"""
print_sum(["a", "b", "c"])

# endregion
