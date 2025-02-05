//                            _________               _____ _____
//                               __  ____/______ _______ __  /____(_)_______ ____  _______
//                               _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
//                               / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
//                               \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/
//
//                                        Chat, Edit, and Autocomplete tutorial
//


// —————————————————————————————————————————————————     Chat      —————————————————————————————————————————————————

// Highlight the code below
// Press [Cmd/Ctrl + J] to add to Chat
// Try asking Continue "what sorting algorithm is this?"
public static int[] sortingAlgorithm(int[] x) {
    for (int i = 0; i < x.length; i++) {
        for (int j = 0; j < x.length - 1; j++) {
            if (x[j] > x[j + 1]) {
                int temp = x[j];
                x[j] = x[j + 1];
                x[j + 1] = temp;
            }
        }
    }
    return x;
}

// —————————————————————————————————————————————————     Edit      ————————————————————————————————————————————————— 

// Highlight the code below
// Press [Cmd/Ctrl + I] to Edit
// Try asking Continue to "make this more readable"
public static int[] sortingAlgorithm2(int[] x) {
    for (int i = 0; i < x.length; i++) {
        for (int j = 0; j < x.length - 1; j++) {
            if (x[j] > x[j + 1]) {
                int temp = x[j];
                x[j] = x[j + 1];
                x[j + 1] = temp;
            }
        }
    }
    return x;
}

// —————————————————————————————————————————————     Autocomplete     ——————————————————————————————————————————————

// Place cursor after `sortingAlgorithm...` below and press [Enter]
// Press [Tab] to accept the Autocomplete suggestion

// Basic assertion for sortingAlgorithm...


// ——————————————————      Learn more at https://docs.continue.dev/getting-started/overview      ———————————————————
