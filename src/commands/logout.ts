import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logout as workosLogout } from "../auth/workos.js";

export async function logout() {
  const onboardingFlagPath = path.join(
    os.homedir(),
    ".continue",
    ".onboarding_complete"
  );

  // Remove onboarding completion flag so user will go through onboarding again
  if (fs.existsSync(onboardingFlagPath)) {
    fs.unlinkSync(onboardingFlagPath);
  }

  workosLogout();
}
