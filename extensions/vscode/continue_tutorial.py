"""                    _________               _____ _____
                       __  ____/______ _______ __  /____(_)_______ ____  _______
                       _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
                       / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
                       \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/

                                 Chat, Edit, and Autocomplete tutorial
"""


# —————————————————————————————————————————————————     Chat      ————————————————————————————————————————————————— #

## Highlight the code below
## Press [Cmd/Ctrl + L] to add to Chat
## Try asking Continue "what sorting algorithm is this?"
def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
    return x


# —————————————————————————————————————————————————     Edit      ————————————————————————————————————————————————— #

## Highlight the code below
## Press [Cmd/Ctrl + I] to Edit
## Try asking Continue to "make this more readable"
def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
    return x

# —————————————————————————————————————————————     Autocomplete     —————————————————————————————————————————————— #

## Place cursor after `sorting_algorithm...` below and press [Enter]
## Press [Tab] to accept the Autocomplete suggestion

# Basic assertion for sorting_algorithm...


# ——————————————————      Learn more at https://docs.continue.dev/getting-started/overview      ——————————————————— #
