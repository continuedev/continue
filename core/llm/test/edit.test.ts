// import * as dotenv from "dotenv";
// import { ContinueSDK } from "../../commands";
// import EditSlashCommand from "../../commands/slash/edit";
// import FileSystemIde from "../../ide/filesystem";
// import FreeTrial from "../llms/FreeTrial";

// jest.setTimeout(100_000);

// dotenv.config();

// describe("/edit slash command", () => {
//   test("doesn't break", async () => {
//     const command = EditSlashCommand;
//     const sdk: ContinueSDK = {
//       ide: new FileSystemIde(),
//       llm: new FreeTrial({ model: "gpt-3.5-turbo" }),
//       addContextItem: (item: any) => {},
//       history: [],
//       input: "implement this function",
//       contextItems: [
//         {
//           name: "editme.py (1-2)",
//           description:
//             "/Users/natesesti/Desktop/continue/core/llm/test/editme.py",
//           content: "def average(nums: list) -> float:\n    pass\n",
//           id: {
//             providerTitle: "file",
//             itemId: "/Users/natesesti/Desktop/continue/core/llm/test/editme.py",
//           },
//         },
//       ],
//       options: {},
//     };

//     let total = "";
//     for await (const update of command.run(sdk)) {
//       total += update;
//     }
//     console.log(total);
//   });
// });
