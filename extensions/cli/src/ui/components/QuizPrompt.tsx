import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

import { defaultBoxStyles } from "../styles.js";

interface QuizPromptProps {
  question: string;
  options?: string[];
  allowCustomAnswer?: boolean;
  defaultAnswer?: string;
  requestId: string;
  onAnswer: (
    requestId: string,
    answer: string,
    isCustomAnswer: boolean,
  ) => void;
}

/**Quiz prompt component for answering for the AskQuestion tool and QuizService */
export const QuizPrompt: React.FC<QuizPromptProps> = ({
  question,
  options: rawOptions,
  allowCustomAnswer = false,
  defaultAnswer,
  requestId,
  onAnswer,
}) => {
  const options = Array.isArray(rawOptions) ? rawOptions : undefined;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCustomMode, setIsCustomMode] = useState(
    !options || options.length === 0,
  ); // allows typing out an answer even when there are options
  const [customInput, setCustomInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const hasOptions = options && options.length > 0;

  useInput((input, key) => {
    if (submitted) return;

    if (isCustomMode) {
      // submit the typed answer
      if (key.return) {
        const answer = customInput.trim() || defaultAnswer || "";
        if (answer) {
          setSubmitted(true);
          onAnswer(requestId, answer, true);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setCustomInput((prev) => prev.slice(0, -1));
        return;
      }

      if (
        hasOptions &&
        allowCustomAnswer &&
        key.upArrow &&
        customInput === ""
      ) {
        // exit out of typing a custom answer
        setIsCustomMode(false);
        setSelectedIndex(options.length - 1);
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        // handle typing a custom answer
        setCustomInput((prev) => prev + input);
      }
      return;
    }

    if (key.return) {
      // submit the selected option
      if (hasOptions && options[selectedIndex]) {
        setSubmitted(true);
        onAnswer(requestId, options[selectedIndex], false);
      }
      return;
    }

    // navigate between options
    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev === 0 ? (hasOptions ? options.length - 1 : 0) : prev - 1,
      );
    } else if (key.downArrow) {
      if (hasOptions) {
        if (selectedIndex === options.length - 1 && allowCustomAnswer) {
          setIsCustomMode(true);
          setSelectedIndex(0);
        } else {
          setSelectedIndex((prev) =>
            prev === options.length - 1 ? 0 : prev + 1,
          );
        }
      }
    }

    if (
      allowCustomAnswer &&
      input &&
      !key.ctrl &&
      !key.meta &&
      !key.upArrow &&
      !key.downArrow
    ) {
      setIsCustomMode(true);
      setCustomInput(input);
    }
  });

  if (submitted) {
    return null;
  }

  return (
    <Box {...defaultBoxStyles("magenta")} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          ?{" "}
        </Text>
        <Text bold>{question}</Text>
      </Box>

      {hasOptions && !isCustomMode && (
        <Box flexDirection="column" marginLeft={2}>
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={index}>
                <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                  {isSelected ? "❯ " : "  "}
                  {option}
                </Text>
              </Box>
            );
          })}
          {allowCustomAnswer && (
            <Box>
              <Text color="gray" dimColor>
                {"  "}(or start typing for custom answer)
              </Text>
            </Box>
          )}
        </Box>
      )}

      {isCustomMode && (
        <Box marginLeft={2} flexDirection="column">
          <Box>
            <Text color="cyan">❯ </Text>
            <Text>{customInput}</Text>
            <Text color="gray">▊</Text>
          </Box>
          {defaultAnswer && !customInput && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                (Press Enter for default: {defaultAnswer})
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {hasOptions && !isCustomMode
            ? "↑/↓ navigate, Enter select"
            : "Type answer, Enter submit"}
        </Text>
      </Box>
    </Box>
  );
};
