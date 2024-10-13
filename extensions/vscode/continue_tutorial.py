"""                    _________               _____ _____
                       __  ____/______ _______ __  /____(_)_______ ____  _______
                       _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
                       / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
                       \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/

                                 Chat, Edit, and Autocomplete tutorial
"""

# ———————————————————— Chat [Cmd/Ctrl + L]: Ask "what sorting algorithm is this?" ————————————————————

def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
    return x

# —————————————————— Edit [Cmd/Ctrl + I]: Tell Continue to "make this more readable" —————————————————

def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
    return x

# ——————————————— Autocomplete [Tab]: Place cursor after `:` below and press [Enter] —————————————————

# Basic assertion for sorting_algorithm:


"—————————————————— Learn more at https://docs.continue.dev/getting-started/overview ————————————————"