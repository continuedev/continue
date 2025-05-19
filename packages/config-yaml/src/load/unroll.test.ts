import { configYamlSchema } from "../schemas/index.js";
import { parseConfigYaml } from "./unroll.js";



describe("config.yaml validation", () => {
  it("parses valid config YAML", () => {
    const yaml = `
name: Local Assistant
version: 1.0.0
schema: v1

models:
  - name: granite3.3:8b
    provider: ollama
    model: granite3.3:8b
    roles:
      - autocomplete
      - chat

  - name: nomic-embed-text
    provider: ollama
    model: nomic-embed-text:latest
    roles:
      - embed

context:
  - provider: code
  - provider: docs
  - provider: diff
  - provider: terminal
  - provider: problems
  - provider: folder
  - provider: codebase
  - provider: clipboard

rules:
  - name: Angry Teenager
    rule: always respond like an angry teenager

docs:
  - name: Continue docs
    startUrl: https://docs.continue.dev/
`;
    const result = parseConfigYaml(yaml);
    expect(result).toMatchObject({ name: "Local Assistant", version: "1.0.0" });
    expect(() => configYamlSchema.parse(result)).not.toThrow();
  });

  it("throws on invalid YAML", () => {
    const yaml = `
name: Local Assistant
version: 1.0.0
schema: v1

models: []

context:
  - provider: code
  - provider: codebase

data:
  - destination: https://docs.continue.dev/
`;

    const expectedError = `Failed to parse assistant:
Validation error: Required at \"data[0].name\"; Required at \"data[0].schema\", or Required at \"data[0].uses\"`;

    expect(() => parseConfigYaml(yaml)).toThrow(expectedError);
  });

});
