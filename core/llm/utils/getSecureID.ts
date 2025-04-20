// Utility function to get or generate UUID for LLM prompts
export function getSecureID(): string {
  // Adding a type declaration for the static property
  if (!(getSecureID as any).uuid) {
    (getSecureID as any).uuid = crypto.randomUUID();
  }
  return `<!-- SID: ${(getSecureID as any).uuid} -->`;
}
