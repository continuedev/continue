import React, { useState } from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  max,
  min,
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleIncrement = () => {
    if (value < max) {
      const newValue = value + 1;
      onChange(newValue);
      setInputValue(newValue.toString());
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      const newValue = value - 1;
      onChange(newValue);
      setInputValue(newValue.toString());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="border-vsc-input-border bg-vsc-input-background flex flex-row overflow-hidden rounded-md border border-solid">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="text-vsc-foreground max-w-9 border-none bg-inherit pr-1.5 text-right outline-none ring-0 focus:border-none focus:outline-none focus:ring-0"
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
          disabled={value >= max}
          className="text-vsc-foreground m-0 mb-0.5 cursor-pointer border-none bg-inherit px-1.5 py-0 hover:opacity-80"
        >
          ▲
        </button>
        <button
          style={{ fontSize: "9px" }}
          className="text-vsc-foreground m-0 mb-0.5 cursor-pointer border-none bg-inherit px-1.5 py-0 hover:opacity-80"
          onClick={handleDecrement}
          disabled={value <= min}
        >
          ▼
        </button>
      </div>
    </div>
  );
};

export default NumberInput;
