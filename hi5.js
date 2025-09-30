#!/usr/bin/env node

/**
 * A fun hi5 implementation for CON-4143
 */

function hi5() {
  const emojis = ["🙏", "✋", "👏", "🎉", "⭐"];
  const messages = [
    "High five! 🙏",
    "Great job! ✋",
    "Awesome work! 👏",
    "You rock! 🎉",
    "Keep it up! ⭐",
  ];

  const randomIndex = Math.floor(Math.random() * messages.length);
  console.log(messages[randomIndex]);

  // ASCII art hi5
  console.log("");
  console.log("    \\o/");
  console.log("     |  <- That's you!");
  console.log("    / \\");
  console.log("");
  console.log("Virtual hi5 complete! 🎯");
}

// Run if called directly
if (require.main === module) {
  hi5();
}

module.exports = { hi5 };
