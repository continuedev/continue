import path from "path";

export default async function () {
  process.env.CONTINUE_GLOBAL_DIR = path.join(__dirname, ".continue-test");
}
