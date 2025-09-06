import { GeneratingIndicator } from "./GeneratingIndicator";

export const IsCompactingToolbar = () => {
  return (
    <div className="flex w-full items-center justify-between">
      <GeneratingIndicator
        text="Generating Summary"
        testId={"notch-compacting-text"}
      />
      <div></div> {/* Empty div to maintain left alignment */}
    </div>
  );
};
