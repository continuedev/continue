import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface OllamaCompletedStepProps {
  text: string;
}

function OllamaCompletedStep({ text }: OllamaCompletedStepProps) {
  return (
    <div className="flex justify-between items-center">
      <p className="text-sm w-3/4 font-mono truncate mr-1">{text}</p>
      <CheckCircleIcon width={24} height={24} className="text-emerald-600" />
    </div>
  );
}

export default OllamaCompletedStep;
