import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logout as workosLogout } from "../auth/workos.js";

export async function logout() {
  workosLogout();
  
  // Remove onboarding completion flag so user will go through onboarding again
  const onboardingFlagPath = path.join(os.homedir(), ".continue", ".onboarding_complete");
  if (fs.existsSync(onboardingFlagPath)) {
    fs.unlinkSync(onboardingFlagPath);
  }
}