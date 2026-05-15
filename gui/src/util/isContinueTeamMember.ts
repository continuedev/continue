/**
 * Utility to check if a user is a YutoAgentic team member
 */
export function isContinueTeamMember(email?: string): boolean {
  if (!email) return false;
  return email.includes("@yutoagentic.dev");
}
