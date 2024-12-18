import { useEffect, useState } from "react";
import { useAppSelector } from "../../redux/hooks";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import { MessageContent } from "core";

interface ThinkingIndicatorProps {
  messageContent: MessageContent;
}
/*
    Thinking animation
    Only for reasoning (long load time) models for now
*/
const ThinkingIndicator = ({ messageContent }: ThinkingIndicatorProps) => {
  // Animation for thinking ellipses
  const [animation, setAnimation] = useState(2);
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimation((prevState) => (prevState === 2 ? 0 : prevState + 1));
    }, 600);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const selectedModel = useAppSelector(selectDefaultModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  const hasContent = Array.isArray(messageContent)
    ? !!messageContent.length
    : !!messageContent;
  const isO1 = selectedModel?.model.startsWith("o1");
  const isThinking = isStreaming && !hasContent;
  if (!isThinking || !isO1) {
    return null;
  }

  return (
    <div className="px-2 py-2">
      <span className="text-stone-500">{`Thinking.${".".repeat(animation)}`}</span>
    </div>
  );
};

export default ThinkingIndicator;
