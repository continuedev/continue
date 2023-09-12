import React from "react";

interface ClassPropertyRefProps {
  name: string;
  details: string;
  required: boolean;
}

export default function ClassPropertyRef(props: ClassPropertyRefProps) {
  const details = JSON.parse(props.details);

  return (
    <>
      <div>
        <h4 style={{ display: "inline-block", marginRight: "10px" }}>
          {props.name}
        </h4>
        <span style={{ color: "red", fontSize: "11px", marginRight: "4px" }}>
          {props.required && "REQUIRED"}
        </span>
        <span>{details.type && `(${details.type})`}</span>
      </div>
      <p>{details.description}</p>
    </>
  );
}
