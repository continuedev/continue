import { ReactNode, useEffect, useRef, useState } from "react";
export default function ExpendableBox({ children }: { children: ReactNode }) {
  const [isExpended, setIsExpended] = useState(false);
  const [showTrigger, setShowTrigger] = useState(true);
  const expendableDivRef = useRef<HTMLDivElement>(null);
  const toggleExpendable = () => {
    setIsExpended((pre) => !pre);
  };

  useEffect(() => {
    if (expendableDivRef.current) {
      expendableDivRef.current.style.maxHeight = isExpended ? "600px" : "0px";
    }

    if (isExpended) {
      setShowTrigger(false);
    } else {
      setTimeout(() => setShowTrigger(true), 200);
    }
  }, [isExpended]);

  return (
    <div className="flex flex-col">
      <div
        onClick={toggleExpendable}
        className={`h-[9px] w-[9px] self-end ${showTrigger ? "" : "hidden"} bg-warning my-2 mr-4 rounded-lg`}
      ></div>

      <div
        onClick={toggleExpendable}
        ref={expendableDivRef}
        style={{
          transition: "max-height 0.3s ease-in-out",
          overflowY: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
