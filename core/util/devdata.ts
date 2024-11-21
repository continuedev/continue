import { writeFileSync } from "fs";

import { getDevDataFilePath } from "./paths.js";

export function logDevData(tableName: string, data: any) {
  const filepath: string = getDevDataFilePath(tableName);
  const jsonLine = JSON.stringify(data);
  writeFileSync(filepath, `${jsonLine}\n`, { flag: "a" });
}
