export const improvePrompt = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`${prompt} (improved)`);
    }, 500);
  });
};
