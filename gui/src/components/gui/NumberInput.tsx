import React from "react";

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
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  return (
    <div className="border-vsc-input-border bg-vsc-input-background flex flex-row overflow-hidden rounded-md border border-solid">
      <input
        type="text"
        value={value}
        readOnly
        className="text-vsc-foreground max-w-7 border-none bg-inherit pr-1.5 text-right outline-none ring-0 focus:border-none focus:outline-none focus:ring-0"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      />
      <div className="flex flex-col">
        <button
          style={{ fontSize: "10px" }}
          onClick={handleIncrement}
          disabled={value >= max}
          className="text-vsc-foreground m-0 mb-0.5 cursor-pointer border-none bg-inherit px-1.5 py-0 hover:opacity-80"
        >
          ▲
        </button>
        <button
          style={{ fontSize: "10px" }}
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
