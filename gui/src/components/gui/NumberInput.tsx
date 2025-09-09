import React, { useState } from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min: number;
  disabled?: boolean;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  max,
  min,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleIncrement = () => {
    if (disabled || value >= max) return;
    const newValue = value + 1;
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleDecrement = () => {
    if (disabled || value <= min) return;
    const newValue = value - 1;
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newInputValue = e.target.value;
    setInputValue(newInputValue);

    // Only update the actual value if it's a valid number
    const numValue = parseInt(newInputValue, 10);
    if (!isNaN(numValue)) {
      // Apply min/max constraints
      const constrainedValue = Math.min(Math.max(numValue, min), max);
      onChange(constrainedValue);
    }
  };

  const handleBlur = () => {
    // When input loses focus, ensure the displayed value matches the actual value
    // This handles cases where the user entered an invalid value
    setInputValue(value.toString());
  };

  return (
    <div
      className={`border-command-border bg-vsc-input-background flex flex-row overflow-hidden rounded-md border border-solid ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        className="text-vsc-foreground max-w-9 border-none bg-inherit pr-1.5 text-right outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
        min={min}
        max={max}
      />
      <div className="flex flex-col">
        <button
          style={{ fontSize: "9px" }}
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="text-vsc-foreground m-0 mb-0.5 cursor-pointer border-none bg-inherit px-1.5 py-0 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ▲
        </button>
        <button
          style={{ fontSize: "9px" }}
          className="text-vsc-foreground m-0 mb-0.5 cursor-pointer border-none bg-inherit px-1.5 py-0 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
        >
          ▼
        </button>
      </div>
    </div>
  );
};

export default NumberInput;
