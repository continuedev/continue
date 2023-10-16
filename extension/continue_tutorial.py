"""
Welcome to Continue!

Click the button in order to try Continue.
"""

# region Part 1: Ask a question about code


# Step 1: Highlight the function below
def mysterious_function(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]

    return x


# Step 2: Use the keyboard shortcut cmd/ctrl + M to select the code and toggle the Continue input box

# Step 3: Ask a question and press Enter

# endregion


# region Part 2: Edit code


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


# Step 2: Use the keyboard shortcut cmd/ctrl + shift + M to select the code and toggle the Continue input box with the /edit slash command

# Step 3: Request an edit and press Enter

# Step 4: Use the keyboard shortcuts to accept (cmd/ctrl + shift + Enter) or reject (cmd/ctrl + shift + Backspace) the edit

# endregion

# region Part 3: Debug automatically


# Step 1: Run this Python file
def print_sum(list_to_print):
    print(sum(list_to_print))


# Step 2: Use the keyboard shortcut cmd/ctrl + shift + R to automatically debug the error
print_sum(["a", "b", "c"])

# endregion
