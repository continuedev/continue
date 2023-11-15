import React from "react";

interface ClassPropertyRefProps {
  name: string;
  details: string;
  required: boolean;
  default: string;
}

const PYTHON_TYPES = {
  string: "str",
  integer: "int",
};

export default function ClassPropertyRef(props: ClassPropertyRefProps) {
  const details = JSON.parse(props.details);

  return (
    <>
      <div>
        <h4 style={{ display: "inline-block", marginRight: "10px" }}>
          {props.name}
        </h4>
        {props.required && (
          <span
            style={{
              color: "red",
              fontSize: "11px",
              marginRight: "4px",
              borderRadius: "4px",
              border: "1px solid red",
              padding: "1px 2px",
            }}
          >
            REQUIRED
          </span>
        )}
        <span>
          {details.type && `(${PYTHON_TYPES[details.type] || details.type})`}
        </span>

        {props.default && (
          <span>
            {" "}
            ={" "}
            <code>
              {details.type === "string" && '"'}
              {props.default}
              {details.type === "string" && '"'}
            </code>
          </span>
        )}
      </div>
      <p>{details.description}</p>
    </>
  );
}
