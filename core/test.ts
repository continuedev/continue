import { open } from "sqlite";
import sqlite3 from "sqlite3";

async function test() {
  const db = await open({
    filename:
      "/Users/natesesti/Library/Application Support/Code - Insiders/User/globalStorage/state.vscdb",
    driver: sqlite3.Database,
  });

  const rows = await db.all(
    "SELECT * FROM ItemTable WHERE key = 'workbench.auxiliarybar.pinnedPanels'"
  );

  const pinnedPanels = rows[0].value === "" ? [] : JSON.parse(rows[0].value);

  if (
    !pinnedPanels.find(
      (panel: any) => panel.id === "workbench.view.extension.continue"
    )
  ) {
    pinnedPanels.push({
      id: "workbench.view.extension.continue",
      pinned: true,
      order: 15,
    });
    await db.run(
      `UPDATE ItemTable SET value = ? WHERE key = 'workbench.auxiliarybar.pinnedPanels'`,
      JSON.stringify(pinnedPanels)
    );
  }
}

export default test;
