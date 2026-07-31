export async function withSigintAbort<T>(
  operation: (abortController: AbortController) => Promise<T>,
): Promise<T> {
  const abortController = new AbortController();
  const abortOnSigint = () => abortController.abort();

  process.once("SIGINT", abortOnSigint);

  try {
    return await operation(abortController);
  } finally {
    process.off("SIGINT", abortOnSigint);
  }
}
