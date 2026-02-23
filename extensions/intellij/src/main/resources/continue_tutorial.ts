//                        _________               _____ _____
//                           __  ____/______ _______ __  /____(_)_______ ____  _______
//                           _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
//                           / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
//                           \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/
//
//                                 Autocomplete, Edit, Chat, and Agent tutorial
//

// —————————————————————————————————————————————     Autocomplete     —————————————————————————————————————————————— //
//                            Autocomplete provides inline code suggestions as you type.

// 1. Place cursor after `sortingAlgorithm:` below and press [Enter]
// 2. Press [Tab] to accept the Autocomplete suggestion

// Basic assertion for sortingAlgorithm:

// —————————————————————————————————————————————————     Edit      ————————————————————————————————————————————————— //
//                   Edit is a convenient way to make quick changes to specific code and files.

// 1. Highlight the code below
// 2. Press [Cmd/Ctrl + I] to Edit
// 3. Try asking Continue to "make this more readable"
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

// —————————————————————————————————————————————————     Chat      ————————————————————————————————————————————————— //
//                    Chat makes it easy to ask for help from an LLM without needing to leave the IDE.

// 1. Highlight the code below
// 2. Press [Cmd/Ctrl + J] to add to Chat
// 3. Try asking Continue "what sorting algorithm is this?"
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

// —————————————————————————————————————————————————     Agent      ————————————————————————————————————————————————— //
//              Agent equips the Chat model with the tools needed to handle a wide range of coding tasks, allowing
//              the model to make decisions and save you the work of manually finding context and performing actions.

// 1. Switch from "Chat" to "Agent" mode using the dropdown in the bottom left of the input box
// 2. Use the "/init" slash command to generate a CONTINUE.md file

  // ——————————————————      Learn more at https://docs.continue.dev      ——————————————————— //
