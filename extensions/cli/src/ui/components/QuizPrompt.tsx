import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

import { defaultBoxStyles } from "../styles.js";

interface QuizPromptProps {
  question: string;
  header?: string;
  options?:
    | string[]
    | Array<{
        label: string;
        description?: string;
        preview?: string;
      }>;
  multiSelect?: boolean;
  allowFreeformInput?: boolean;
  defaultAnswer?: string;
  requestId: string;
  onAnswer: (
    requestId: string,
    answer: string | string[],
    isCustomAnswer: boolean,
  ) => void;
}

/**Quiz prompt component for answering for the AskQuestion tool and QuizService */
export const QuizPrompt: React.FC<QuizPromptProps> = ({
  question,
  header,
  options: rawOptions,
  multiSelect,
  allowFreeformInput = true,
  defaultAnswer,
  requestId,
  onAnswer,
}) => {
  const options = Array.isArray(rawOptions)
    ? rawOptions
        .map((option) =>
          typeof option === "string" ? { label: option } : option,
        )
        .filter(
          (
            option,
          ): option is {
            label: string;
            description?: string;
            preview?: string;
          } => Boolean(option?.label),
        )
    : undefined;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [isCustomMode, setIsCustomMode] = useState(
    !options || options.length === 0,
  ); // allows typing out an answer even when there are options
  const [customInput, setCustomInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const hasOptions = options && options.length > 0;
  const focusedOption =
    hasOptions && !isCustomMode ? options[selectedIndex] : undefined;

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
        allowFreeformInput &&
        hasOptions &&
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
        if (multiSelect) {
          const next = new Set(selectedIndices);
          if (next.size === 0) {
            next.add(selectedIndex);
          }
          const selectedLabels = Array.from(next)
            .sort((a, b) => a - b)
            .map((index) => options[index].label);
          setSubmitted(true);
          onAnswer(requestId, selectedLabels, false);
          return;
        }
        setSubmitted(true);
        onAnswer(requestId, options[selectedIndex].label, false);
      }
      return;
    }

    if (multiSelect && input === " ") {
      if (hasOptions && options[selectedIndex]) {
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          if (next.has(selectedIndex)) {
            next.delete(selectedIndex);
          } else {
            next.add(selectedIndex);
          }
          return next;
        });
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
        if (selectedIndex === options.length - 1) {
          if (allowFreeformInput) {
            setIsCustomMode(true);
          }
          setSelectedIndex(0);
        } else {
          setSelectedIndex((prev) =>
            prev === options.length - 1 ? 0 : prev + 1,
          );
        }
      }
    }

    if (
      allowFreeformInput &&
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
        <Text bold>
          {header ? `[${header}] ` : ""}
          {question}
        </Text>
      </Box>

      {hasOptions && !isCustomMode && (
        <Box flexDirection="column" marginLeft={2}>
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            const isChecked = selectedIndices.has(index);
            return (
              <Box key={index} flexDirection="column" marginBottom={1}>
                <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                  {isSelected ? "❯ " : "  "}
                  {multiSelect ? (isChecked ? "[x] " : "[ ] ") : ""}
                  {option.label}
                </Text>
                {option.description ? (
                  <Text color="gray" dimColor>
                    {"   "}
                    {option.description}
                  </Text>
                ) : null}
              </Box>
            );
          })}
          {allowFreeformInput ? (
            <Box>
              <Text color="gray" dimColor>
                {"  "}(or start typing for custom answer)
              </Text>
            </Box>
          ) : null}
        </Box>
      )}

      {focusedOption?.preview ? (
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text color="gray" dimColor>
            Preview:
          </Text>
          <Text color="white">{focusedOption.preview}</Text>
        </Box>
      ) : null}

      {isCustomMode && allowFreeformInput && (
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
            ? multiSelect
              ? "↑/↓ navigate, Space toggle, Enter submit"
              : "↑/↓ navigate, Enter select"
            : "Type answer, Enter submit"}
        </Text>
      </Box>
    </Box>
  );
};
