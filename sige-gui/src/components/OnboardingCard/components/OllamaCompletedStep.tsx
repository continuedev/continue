import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface OllamaCompletedStepProps {
  text: string;
}

function OllamaCompletedStep({ text }: OllamaCompletedStepProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="lines mr-1 w-3/4 font-mono text-sm leading-none">{text}</p>
      <CheckCircleIcon width={24} height={24} className="text-emerald-600" />
    </div>
  );
}

export default OllamaCompletedStep;
