/**
 * Utility to check if a user is a Continue team member
 */
export function isContinueTeamMember(email?: string): boolean {
  if (!email) return false;
  return email.includes("@continue.dev");
}
