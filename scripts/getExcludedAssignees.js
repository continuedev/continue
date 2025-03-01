#!/usr/bin/env node

function removeStringFromList(list, stringToRemove) {
  return list.filter((item) => item !== stringToRemove);
}

function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: node script.js <comma-separated-list> <string-to-remove>",
    );
    process.exit(1);
  }

  const list = args[0].split(",");
  const stringToRemove = args[1];

  const result = removeStringFromList(list, stringToRemove);

  // Output the result as comma-separated values
  console.log(result.join(","));
}

main();
