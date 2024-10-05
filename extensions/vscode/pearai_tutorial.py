"""
Welcome to a 1 minute tutorial for PearAI!

You can click the gray buttons, starting with "Highlight the function" to follow along.
"""

# region —————————————————————————— Part 1: Ask about code [Ctrl+L] ——————————————————————————


"""Step 1: Highlight the function below"""
def mysterious_function(y, z):
    a, b = 0, len(y) - 1
    while a <= b:
        c = (a + b) // 2
        if y[c] == z: return c
        a, b = ((c + 1, b) if y[c] < z else (a, c - 1))
    return -1

"""Step 2: Use the keyboard shortcut [Cmd+L] to
select the code and toggle the PearAI input box"""

"""Step 3: Ask a question like "What does this code do?" and press Enter"""
"""Note that you can include context of your codebase by pressing Cmd+Enter"""

# endregion

# region ————————————————————————————————— Part 2: Edit code [Cmd+I] —————————————————————————————————


"""Step 1: Highlight this code"""
def filter_even_nums(nums):
    if not isinstance(nums, list):
        raise ValueError("Input must be a list.")
        
    even_nums = []
    for x in nums:
        if not isinstance(x, int):
            raise ValueError("All elements in the list must be integers.")
        if x % 2 == 0:
            even_nums.append(x)
    return even_nums

"""Step 2: Use the keyboard shortcut [Cmd+I] to edit"""

"""Step 3: Type "Handle edge cases" and press Enter"""

"""Step 4: Use keyboard shortcuts to
accept [Cmd+Shift+Enter] or reject [Cmd+Shift+Backspace] the edit"""

# endregion

# region ———————————————————————————— Part 3: Debug automatically [Cmd+Shift+R] ————————————————————————————


"""Step 1: Run this Python file (pearai_tutorial.py), and it will error. Let's debug it!"""
def print_list(l):
    for i in range(len(l)+1):
        print(l[i])

"""Step 2: Use the keyboard shortcut [Cmd+Shift+R]
to automatically debug the error"""
print_list(["a", "b", "c"])

# endregion

# Now you know some of PearAI's basic features! Enjoy and learn more at https://trypear.ai!
