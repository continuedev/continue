import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

describe("VS Code package manifest", () => {
  it("contributes each command identifier once", () => {
    const commandIds = packageJson.contributes.commands.map(
      ({ command }) => command,
    );
    const duplicateCommandIds = [
      ...new Set(
        commandIds.filter(
          (command, index) => commandIds.indexOf(command) !== index,
        ),
      ),
    ];

    expect(duplicateCommandIds).toEqual([]);
  });
});
