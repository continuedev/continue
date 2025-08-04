/**
 * @file Generate config.yaml file from template. Also intended to run as a child process.
 */

const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const { execCmdSync } = require("../../../scripts/util");

const { continueDir } = require("./utils");

async function generateConfigYamlSchema() {
  process.chdir(path.join(continueDir, "packages", "config-yaml"));
  execCmdSync("npm install");
  execCmdSync("npm run build");
  execCmdSync("npm run generate-schema");
  fs.copyFileSync(
    path.join("schema", "config-yaml-schema.json"),
    path.join(continueDir, "extensions", "vscode", "config-yaml-schema.json"),
  );
  console.log("[info] Generated config.yaml schema");
}

async function copyConfigSchema() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  // Modify and copy for .continuerc.json
  const schema = JSON.parse(fs.readFileSync("config_schema.json", "utf8"));
  schema.$defs.SerializedContinueConfig.properties.mergeBehavior = {
    type: "string",
    enum: ["merge", "overwrite"],
    default: "merge",
    title: "Merge behavior",
    markdownDescription:
      "If set to 'merge', .continuerc.json will be applied on top of config.json (arrays and objects are merged). If set to 'overwrite', then every top-level property of .continuerc.json will overwrite that property from config.json.",
    "x-intellij-html-description":
      "<p>If set to <code>merge</code>, <code>.continuerc.json</code> will be applied on top of <code>config.json</code> (arrays and objects are merged). If set to <code>overwrite</code>, then every top-level property of <code>.continuerc.json</code> will overwrite that property from <code>config.json</code>.</p>",
  };
  fs.writeFileSync("continue_rc_schema.json", JSON.stringify(schema, null, 2));

  // Copy config schemas to intellij
  fs.copyFileSync(
    "config_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "config_schema.json",
    ),
  );
  fs.copyFileSync(
    "continue_rc_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "continue_rc_schema.json",
    ),
  );
}

process.on("message", (msg) => {
  const { operation } = msg.payload;
  if (operation === "generate") {
    generateConfigYamlSchema()
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
  if (operation === "copy") {
    copyConfigSchema()
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
});

async function generateAndCopyConfigYamlSchema() {
  // Generate and copy over config-yaml-schema.json
  const generateConfigYamlChild = fork(
    path.join(__dirname, "generate-copy-config.js"),
    {
      stdio: "inherit",
    },
  );
  generateConfigYamlChild.send({ payload: { operation: "generate" } });

  await new Promise((resolve, reject) => {
    generateConfigYamlChild.on("message", (msg) => {
      if (msg.error) {
        reject();
      }
      resolve();
    });
  });

  // Copy config schemas to intellij
  const copyConfigSchemaChild = fork(
    path.join(__dirname, "generate-copy-config.js"),
    {
      stdio: "inherit",
    },
  );
  copyConfigSchemaChild.send({ payload: { operation: "copy" } });

  await new Promise((resolve, reject) => {
    copyConfigSchemaChild.on("message", (msg) => {
      if (msg.error) {
        reject();
      }
      resolve();
    });
  });
}

module.exports = {
  generateAndCopyConfigYamlSchema,
};
