export const fetchWithExponentialBackoff = async (
  url: string,
  options: RequestInit,
  retries = 5,
  delay = 1000,
): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status === 429 && retries > 0) {
      // Wait for delay milliseconds and retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithExponentialBackoff(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      // Wait for delay milliseconds and retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithExponentialBackoff(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};
