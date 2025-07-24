import { logout as workosLogout } from "../auth/workos.js";

export async function logout() {
  workosLogout();
}
