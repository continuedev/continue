// import fs from "node:fs";
// import path from "node:path";
// import { ConfigHandler } from "../../config/ConfigHandler.js";
// import { ContinueServerClient } from "../../continueServer/stubs/client.js";
// import { CodebaseIndexer, PauseToken } from "../../indexing/CodebaseIndexer.js";
// import { LanceDbIndex } from "../../indexing/LanceDbIndex.js";
// import TransformersJsEmbeddingsProvider from "../../indexing/embeddings/TransformersJsEmbeddingsProvider.js";
// import FileSystemIde from "../../util/filesystem.js";
// import {
//   getIndexFolderPath,
//   getIndexSqlitePath,
//   getLanceDbPath,
// } from "../../util/paths.js";
// import {
//   addToTestDir,
//   setUpTestDir,
//   tearDownTestDir,
//   TEST_DIR,
// } from "../testUtils/testDir.js";

// const TEST_TS = `\
// function main() {
//   console.log("Hello, world!");
// }

// class Foo {
//   constructor(public bar: string) {}
// }
// `;

// const TEST_PY = `\
// def main():
//     print("Hello, world!")

// class Foo:
//     def __init__(self, bar: str):
//         self.bar = bar
// `;

// const TEST_RS = `\
// fn main() {
//     println!("Hello, world!");
// }

// struct Foo {
//     bar: String,
// }
// `;

// // These are more like integration tests, whereas we should separately test
// // the individual CodebaseIndex classes
// describe.skip("CodebaseIndexer", () => {
//   const ide = new FileSystemIde(TEST_DIR);
//   const ideSettingsPromise = ide.getIdeSettings();
//   const configHandler = new ConfigHandler(
//     ide,
//     ideSettingsPromise,
//     async (text) => {},
//     undefined as any, // TODO
//   );
//   const pauseToken = new PauseToken(false);
//   const continueServerClient = new ContinueServerClient(undefined, undefined);
//   const codebaseIndexer = new CodebaseIndexer(
//     configHandler,
//     ide,
//     pauseToken,
//     continueServerClient,
//   );
//   const lancedbIndex = new LanceDbIndex(
//     new TransformersJsEmbeddingsProvider(),
//     ide.readFile.bind(ide),
//     continueServerClient,
//   );

//   beforeAll(async () => {
//     setUpTestDir();
//   });

//   afterAll(async () => {
//     tearDownTestDir();
//   });

//   test("should index test folder without problem", async () => {
//     addToTestDir([
//       ["test.ts", TEST_TS],
//       ["py/main.py", TEST_PY],
//     ]);
//     const abortController = new AbortController();
//     const abortSignal = abortController.signal;

//     const updates = [];
//     for await (const update of codebaseIndexer.refresh(
//       [TEST_DIR],
//       abortSignal,
//     )) {
//       updates.push(update);
//     }

//     expect(updates.length).toBeGreaterThan(0);
//   });

//   test("should have created index folder with all necessary files", async () => {
//     expect(fs.existsSync(getIndexFolderPath())).toBe(true);
//     expect(fs.existsSync(getIndexSqlitePath())).toBe(true);
//     expect(fs.existsSync(getLanceDbPath())).toBe(true);
//   });

//   test("should be able to query lancedb index", async () => {
//     const chunks = await lancedbIndex.retrieve(
//       "What is the main function doing?",
//       10,
//       await ide.getTags(lancedbIndex.artifactId),
//       undefined,
//     );

//     expect(chunks.length).toBe(2);
//     // Check that the main function from both files is returned
//     expect(chunks.some((chunk) => chunk.filepath.endsWith("test.ts"))).toBe(
//       true,
//     );
//     expect(chunks.some((chunk) => chunk.filepath.endsWith("main.py"))).toBe(
//       true,
//     );
//   });

//   test("should successfully re-index after adding a file", async () => {
//     addToTestDir([["main.rs", TEST_RS]]);
//     const abortController = new AbortController();
//     const abortSignal = abortController.signal;
//     const updates = [];
//     for await (const update of codebaseIndexer.refresh(
//       [TEST_DIR],
//       abortSignal,
//     )) {
//       updates.push(update);
//     }
//     expect(updates.length).toBeGreaterThan(0);
//     // Check that the new file was indexed
//     const chunks = await lancedbIndex.retrieve(
//       "What is the main function doing?",
//       3,
//       await ide.getTags(lancedbIndex.artifactId),
//       undefined,
//     );
//     expect(chunks.length).toBe(3);
//     expect(chunks.some((chunk) => chunk.filepath.endsWith("main.rs"))).toBe(
//       true,
//     );
//   });

//   test("should successfully re-index after deleting a file", async () => {
//     fs.rmSync(path.join(TEST_DIR, "main.rs"));
//     const abortController = new AbortController();
//     const abortSignal = abortController.signal;
//     const updates = [];
//     for await (const update of codebaseIndexer.refresh(
//       [TEST_DIR],
//       abortSignal,
//     )) {
//       updates.push(update);
//     }
//     expect(updates.length).toBeGreaterThan(0);
//     // Check that the deleted file was removed from the index
//     const chunks = await lancedbIndex.retrieve(
//       "What is the main function doing?",
//       10,
//       await ide.getTags(lancedbIndex.artifactId),
//       undefined,
//     );
//     expect(chunks.length).toBe(2);
//     expect(chunks.every((chunk) => !chunk.filepath.endsWith("main.rs"))).toBe(
//       true,
//     );
//   });
// });
