export function isNextEditTest(): boolean {
  const enabled = process.env.NEXT_EDIT_TEST_ENABLED;

  if (enabled === "false") {
    return false;
  }

  if (enabled === "true") {
    return true;
  }

  return false;
}
