//                        _________               _____ _____
//                           __  ____/______ _______ __  /____(_)_______ ____  _______
//                           _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
//                           / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
//                           \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/
//
//                                       Chat, Edit, and Autocomplete tutorial
//

// ————————————————————————————————————————————————     Setup      ————————————————————————————————————————————————-

// First, open the Continue sidebar by pressing [Cmd + L] or clicking the Continue icon.

// See an example at https://docs.continue.dev/getting-started/install

// Follow the instructions in the sidebar to set up models for Chat and Autocomplete.

// —————————————————————————————————————————————————     Chat      —————————————————————————————————————————————————

// Highlight the code below
// Press [Cmd + L] to add to Chat
// Try asking Continue "what sorting algorithm is this?"
function sortingAlgorithm(x: number[]): number[] {
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < x.length - 1; j++) {
      if (x[j] > x[j + 1]) {
        let temp = x[j];
        x[j] = x[j + 1];
        x[j + 1] = temp;
      }
    }
  }
  return x;
}

// [Cmd + L] always starts a new chat. Now, try the same thing using [Cmd + Shift + L].
// This will add the code into the current chat

// —————————————————————————————————————————————————     Edit      —————————————————————————————————————————————————

// Highlight the code below
// Press [Cmd + I] to Edit
// Try asking Continue to "make this more readable"
function sortingAlgorithm2(x: number[]): number[] {
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < x.length - 1; j++) {
      if (x[j] > x[j + 1]) {
        let temp = x[j];
        x[j] = x[j + 1];
        x[j + 1] = temp;
      }
    }
  }
  return x;
}

// —————————————————————————————————————————————     Autocomplete     ——————————————————————————————————————————————

// Place cursor after `sortingAlgorithm:` below and press [Enter]
// Press [Tab] to accept the Autocomplete suggestion

// Basic assertion for sortingAlgorithm:

// —————————————————————————————————————————————-     Learn More     -——————————————————————————————————————————————

// Visit the Continue Docs at https://docs.continue.dev/getting-started/overview
