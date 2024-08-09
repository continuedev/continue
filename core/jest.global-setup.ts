import fs from "fs";
import path from "path";

export default async function () {
  process.env.CONTINUE_GLOBAL_DIR = path.join(__dirname, ".continue-test");
  if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR)) {
    fs.rmSync(process.env.CONTINUE_GLOBAL_DIR, { recursive: true });
  }
}
