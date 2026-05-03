import { ToolImpl } from ".";

const MAX_SLEEP_SECONDS = 300;

export const sleepToolImpl: ToolImpl = async (args) => {
  const seconds =
    typeof args?.seconds === "number" ? Math.floor(args.seconds) : NaN;

  if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_SLEEP_SECONDS) {
    return [
      {
        name: "Sleep",
        description: "Invalid duration",
        content: `Sleep duration must be an integer between 1 and ${MAX_SLEEP_SECONDS} seconds.`,
      },
    ];
  }

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  return [
    {
      name: "Sleep",
      description: "Completed wait",
      content: `Slept for ${seconds} second${seconds === 1 ? "" : "s"}.`,
    },
  ];
};